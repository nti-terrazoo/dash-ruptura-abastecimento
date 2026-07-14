"""Orquestra raw_data (acesso as views) + regras de negocio (core/) para
montar a resposta ja processada de cada aba do dashboard - equivalente ao
processData() do HTML legado, agora rodando no servidor (uma vez, cacheado)
em vez de no browser a cada troca de filtro.
"""

import concurrent.futures
import datetime

from app.core.business_rules import (
    CRIT_LEGACY_FACTOR,
    EXCLUDED_BRIDGE_UNIDADES,
    SEG_METAS,
    VALID_SEGMENTOS,
    fornecedor_color,
    get_dde_meta,
    is_excluded_store,
    loja_color,
    loja_status,
    match_bridge_status,
    norm_seg,
    segmento_color,
)
from app.core.calculations import (
    aggregate_bridge_status_totals,
    normalize_percentual,
    split_bridge_by_official_total,
)
from app.services import raw_data


def _kpi_from_rows(rows: list[dict]) -> dict:
    if not rows:
        return {"percentual": 0.0, "valor": 0.0}
    row = rows[0]
    return {
        "percentual": normalize_percentual(row.get("ruptura_percentual") or 0.0),
        "valor": row.get("ruptura_valor_venda") or 0.0,
    }


def _valid_bridge_rows(rows: list[dict]) -> list[dict]:
    return [
        r
        for r in rows
        if str(r.get("cod_unidade")) not in EXCLUDED_BRIDGE_UNIDADES and (r.get("ruptura_valor_venda") or 0) > 0
    ]


def _map_bridge_item(row: dict) -> dict:
    situacao = row.get("situacao")
    status_def = match_bridge_status(situacao)
    return {
        "cod_produto": row.get("cod_produto"),
        "produto": row.get("descricao_produto"),
        "cod_unidade": row.get("cod_unidade"),
        "loja": row.get("nome_fantasia_loja"),
        "segmento": norm_seg(row.get("segmento")),
        "fornecedor": row.get("nome_fantasia_fornecedor"),
        "valor": row.get("ruptura_valor_venda") or 0.0,
        "situacao": situacao,
        "status_label": status_def["label"] if status_def else None,
    }


def _pick_item_critico(rows: list[dict]) -> dict | None:
    valid = _valid_bridge_rows(rows)
    if not valid:
        return None
    top = max(valid, key=lambda r: r.get("ruptura_valor_venda") or 0.0)
    return _map_bridge_item(top)


def get_segmentos_today(data_referencia: datetime.date) -> dict[str, dict]:
    """Percentual/valor de ruptura por segmento no dia. Fonte primaria:
    VW_DASH_PLANILHA_GRAFICO (ja vem por segmento). Complementa com
    VW_DASH_PLANILHA_GERAL (agregado por segmento) apenas para segmentos
    ausentes na fonte primaria - replica a regra de "complementacao entre
    fontes" do HTML original (SEG_SERIES/SEGS_TODAY)."""
    result: dict[str, dict] = {}
    for row in raw_data.get_planilha_grafico(data_referencia):
        seg = row.get("segmento")
        if not seg:
            continue
        valor = row.get("ruptura_valor_venda") or 0.0
        percentual = normalize_percentual(row.get("ruptura_percentual") or 0.0)
        if valor <= 0 and percentual <= 0:
            continue
        result[seg] = {"valor": valor, "percentual": percentual}

    missing = [s for s in VALID_SEGMENTOS if s not in result]
    if missing:
        agg: dict[str, dict] = {}
        for row in raw_data.get_planilha_geral(data_referencia):
            seg = row.get("segmento")
            if seg not in missing:
                continue
            valor = row.get("ruptura_valor_venda") or 0.0
            percentual = normalize_percentual(row.get("ruptura_percentual") or 0.0)
            entry = agg.setdefault(seg, {"valor": 0.0, "percentual": 0.0})
            entry["valor"] += valor
            if percentual > 0:
                entry["percentual"] = percentual
        result.update(agg)
    return result


def get_overview(data_referencia: datetime.date) -> dict:
    """KPIs da Visao Geral, exceto o item critico (ver get_overview_item_critico) -
    isolado numa consulta separada porque exige varrer a bridge inteira
    (a maior view) e e a parte mais lenta do dashboard. As demais consultas
    sao independentes entre si e rodam em paralelo (conexoes distintas do
    pool Oracle) em vez de sequencialmente, para reduzir a latencia do
    primeiro carregamento do dia (cache frio)."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_dde_geral = executor.submit(raw_data.get_dde_geral, data_referencia)
        future_dde_forn = executor.submit(raw_data.get_dde_fornecedor, data_referencia)
        future_seg_today = executor.submit(get_segmentos_today, data_referencia)
        future_dia = executor.submit(raw_data.get_dia_a_dia, data_referencia)
        future_dia_cd = executor.submit(raw_data.get_dia_a_dia_cd, data_referencia)

        dde_geral_rows = future_dde_geral.result()
        dde_forn_rows = future_dde_forn.result()
        seg_today = future_seg_today.result()
        dia_rows = future_dia.result()
        dia_cd_rows = future_dia_cd.result()

    top_fornecedores_dde = sorted(
        (
            {"fornecedor": r.get("nome_fantasia_fornecedor"), "dde": r["dias_estoque"]}
            for r in dde_forn_rows
            if r.get("dias_estoque") and 0 < r["dias_estoque"] <= 400
        ),
        key=lambda x: x["dde"],
        reverse=True,
    )[:3]

    top_segmentos = sorted(
        ({"segmento": seg, "percentual": vals["percentual"]} for seg, vals in seg_today.items()),
        key=lambda x: x["percentual"],
        reverse=True,
    )[:3]

    ruptura_por_segmento = []
    for seg, vals in seg_today.items():
        meta = SEG_METAS.get(seg)
        acima = meta is not None and vals["percentual"] > meta
        ruptura_por_segmento.append(
            {
                "segmento": seg,
                "valor": vals["valor"],
                "percentual": vals["percentual"],
                "meta": meta,
                "acima_meta": acima,
                "cor": "#e05555" if acima else segmento_color(seg),
            }
        )
    ruptura_por_segmento.sort(key=lambda x: x["percentual"], reverse=True)

    return {
        "data_referencia": data_referencia,
        "meta_percentual": 10,
        "ruptura_sem_cd": _kpi_from_rows(dia_rows),
        "ruptura_com_cd": _kpi_from_rows(dia_cd_rows),
        "dde_geral": dde_geral_rows[0]["dias_estoque"] if dde_geral_rows else None,
        "top_fornecedores_dde": top_fornecedores_dde,
        "top_segmentos": top_segmentos,
        "ruptura_por_segmento": ruptura_por_segmento,
    }


def get_overview_item_critico(data_referencia: datetime.date) -> dict:
    """Isolado de get_overview: usa uma query dedicada que ja pede pro Oracle
    ordenar e devolver so a linha de maior valor (ver
    queries.LOJAS_BRIDGE_TOP_CRITICO), em vez de trazer a bridge inteira e
    achar o maximo em Python - a mesma logica de exclusao (valor>0, lojas nao
    monitoradas) so que resolvida no banco, que e muito mais rapido para uma
    view desse tamanho."""
    rows = raw_data.get_lojas_bridge_top_critico(data_referencia)
    item_critico = _map_bridge_item(rows[0]) if rows else None
    return {"data_referencia": data_referencia, "item_critico": item_critico}


def get_series(data_referencia: datetime.date, dias: int = 15, com_cd: bool = False) -> dict:
    inicio = data_referencia - datetime.timedelta(days=dias - 1)
    rows = (
        raw_data.get_dia_a_dia_cd_range(inicio, data_referencia)
        if com_cd
        else raw_data.get_dia_a_dia_range(inicio, data_referencia)
    )
    pontos = [
        {
            "data": r["data_referencia"],
            "valor": r.get("ruptura_valor_venda") or 0.0,
            "percentual": normalize_percentual(r.get("ruptura_percentual") or 0.0),
        }
        for r in rows
    ]
    return {"dias": dias, "com_cd": com_cd, "pontos": pontos}


def get_lojas(data_referencia: datetime.date) -> dict:
    dde_by_unidade = {r["cod_unidade"]: r.get("dias_estoque") for r in raw_data.get_dde_lojas(data_referencia)}

    lojas = []
    for r in raw_data.get_lojas(data_referencia):
        nome = r.get("nome_fantasia_loja") or ""
        if is_excluded_store(nome):
            continue
        percentual = normalize_percentual(r.get("ruptura_percentual") or 0.0)
        valor = r.get("ruptura_valor_venda") or 0.0
        cod_unidade = r.get("cod_unidade")
        lojas.append(
            {
                "cod_unidade": cod_unidade,
                "nome": nome,
                "valor": valor,
                "percentual": percentual,
                "dde": dde_by_unidade.get(cod_unidade),
                "status": loja_status(percentual),
                "cor": loja_color(percentual),
            }
        )
    lojas.sort(key=lambda x: x["percentual"], reverse=True)
    return {
        "data_referencia": data_referencia,
        "lojas": lojas,
        "dentro_meta": [l for l in lojas if l["percentual"] <= 10],
        "acima_meta": [l for l in lojas if l["percentual"] > 10],
    }


def get_loja_detail(data_referencia: datetime.date, cod_unidade: str) -> dict | None:
    lojas_data = get_lojas(data_referencia)
    loja = next((l for l in lojas_data["lojas"] if str(l["cod_unidade"]) == str(cod_unidade)), None)
    if loja is None:
        return None

    bridge_rows = [
        r for r in _valid_bridge_rows(raw_data.get_lojas_bridge(data_referencia))
        if str(r.get("cod_unidade")) == str(cod_unidade)
    ]
    seg_totais: dict[str, float] = {}
    for r in bridge_rows:
        seg = norm_seg(r.get("segmento"))
        seg_totais[seg] = seg_totais.get(seg, 0.0) + (r.get("ruptura_valor_venda") or 0.0)
    segmentos_ofensores = sorted(
        ({"segmento": s, "valor": v} for s, v in seg_totais.items()), key=lambda x: x["valor"], reverse=True
    )
    top_itens = sorted(bridge_rows, key=lambda r: r.get("ruptura_valor_venda") or 0.0, reverse=True)[:10]

    return {
        "data_referencia": data_referencia,
        "cod_unidade": loja["cod_unidade"],
        "nome": loja["nome"],
        "percentual": loja["percentual"],
        "valor": loja["valor"],
        "dde": loja["dde"],
        "status": loja["status"],
        "segmentos_ofensores": segmentos_ofensores,
        "top_itens": [_map_bridge_item(r) for r in top_itens],
    }


def get_fornecedores(data_referencia: datetime.date, segmento: str = "TODOS") -> dict:
    """Ranking de fornecedores por valor (R$) em ruptura - mesmo criterio do
    HTML legado (`D.FORN = Object.values(fornMap).sort((a,b)=>b.v-a.v)`, dash
    26.06.html linha 1430). Fonte primaria: VW_DASH_PLANILHA_GERAL (permite
    filtrar por segmento). Se nao houver linhas (ex. segmento sem
    correspondencia), cai para VW_DASH_FORNECEDORES (sem quebra por segmento)
    - mesma relacao primaria/fallback do HTML original entre base_geral e
    base_forn.

    Nota: quando um fornecedor aparece em mais de um segmento, o percentual
    agregado usa media ponderada por valor (mais estavel que "ultimo valor
    nao-zero" do JS legado, que nao generaliza bem para uma soma
    multi-segmento); o valor agregado (soma) e identico ao original.
    """
    seg_filtro = None if segmento.upper() == "TODOS" else norm_seg(segmento)
    dde_by_forn = {
        r.get("nome_fantasia_fornecedor"): r.get("dias_estoque") for r in raw_data.get_dde_fornecedor(data_referencia)
    }

    agg: dict[str, dict] = {}
    for r in raw_data.get_planilha_geral(data_referencia):
        if seg_filtro and norm_seg(r.get("segmento")) != seg_filtro:
            continue
        forn = r.get("nome_fantasia_fornecedor") or ""
        if not forn:
            continue
        valor = r.get("ruptura_valor_venda") or 0.0
        percentual = normalize_percentual(r.get("ruptura_percentual") or 0.0)
        entry = agg.setdefault(forn, {"valor": 0.0, "pv_acumulado": 0.0})
        entry["valor"] += valor
        entry["pv_acumulado"] += percentual * valor

    if not agg:
        for r in raw_data.get_fornecedores(data_referencia):
            forn = r.get("nome_fantasia_fornecedor") or ""
            if not forn:
                continue
            valor = r.get("ruptura_valor_venda") or 0.0
            percentual = normalize_percentual(r.get("ruptura_percentual") or 0.0)
            agg[forn] = {"valor": valor, "pv_acumulado": percentual * valor}

    ranking = []
    for forn, vals in agg.items():
        valor = vals["valor"]
        percentual = (vals["pv_acumulado"] / valor) if valor > 0 else 0.0
        ranking.append(
            {
                "fornecedor": forn,
                "valor": valor,
                "percentual": percentual,
                "dde": dde_by_forn.get(forn),
                "cor": fornecedor_color(percentual),
            }
        )
    ranking.sort(key=lambda x: x["valor"], reverse=True)

    return {
        "data_referencia": data_referencia,
        "segmento": segmento,
        "destaques": ranking[:3],
        "ranking": ranking,
    }


def _bridge_official_totals(
    data_referencia: datetime.date, mode: str, chave: str | None
) -> tuple[float, float, float | None]:
    # A meta do waterfall e sempre 10% (meta geral), mesmo no modo "segmento"
    # - o HTML legado sempre desenha a partir da meta geral de 10% ali
    # (comentario original: "brOrig=D.BRIDGE; // sempre usa meta geral de
    # 10%", dash 26.06.html linha 2336), independente da meta propria do
    # segmento (SEG_METAS). Nao usar SEG_METAS.get(seg) aqui.
    if mode == "geral":
        rows = raw_data.get_dia_a_dia(data_referencia)
        kpi = _kpi_from_rows(rows)
        return kpi["percentual"], kpi["valor"], 10
    if mode == "segmento":
        seg = norm_seg(chave or "")
        vals = get_segmentos_today(data_referencia).get(seg, {"valor": 0.0, "percentual": 0.0})
        return vals["percentual"], vals["valor"], 10
    if mode == "loja":
        loja = next(
            (l for l in get_lojas(data_referencia)["lojas"] if str(l["cod_unidade"]) == str(chave)), None
        )
        if loja is None:
            return 0.0, 0.0, 10
        return loja["percentual"], loja["valor"], 10
    raise ValueError(f"modo de bridge invalido: {mode}")


def _bridge_filtered_rows(data_referencia: datetime.date, mode: str, chave: str | None) -> list[dict]:
    rows = _valid_bridge_rows(raw_data.get_lojas_bridge(data_referencia))
    if mode == "segmento":
        seg = norm_seg(chave or "")
        rows = [r for r in rows if norm_seg(r.get("segmento")) == seg]
    elif mode == "loja":
        rows = [r for r in rows if str(r.get("cod_unidade")) == str(chave)]
    return rows


def get_bridge(data_referencia: datetime.date, mode: str = "geral", chave: str | None = None) -> dict:
    pct, valor, meta = _bridge_official_totals(data_referencia, mode, chave)
    rows = _bridge_filtered_rows(data_referencia, mode, chave)
    totals = aggregate_bridge_status_totals(
        [{"valor": r.get("ruptura_valor_venda") or 0.0, "situacao": r.get("situacao")} for r in rows]
    )
    statuses = split_bridge_by_official_total(totals, valor, pct)
    return {
        "data_referencia": data_referencia,
        "mode": mode,
        "chave": chave,
        "meta_percentual": meta,
        "percentual_atual": pct,
        "valor_atual": valor,
        "statuses": statuses,
    }


def get_bridge_drilldown(
    data_referencia: datetime.date, mode: str, chave: str | None, status_label: str
) -> dict:
    rows = _bridge_filtered_rows(data_referencia, mode, chave)
    matched = [r for r in rows if (match_bridge_status(r.get("situacao")) or {}).get("label") == status_label]
    matched.sort(key=lambda r: r.get("ruptura_valor_venda") or 0.0, reverse=True)
    return {
        "data_referencia": data_referencia,
        "mode": mode,
        "chave": chave,
        "status_label": status_label,
        "itens": [_map_bridge_item(r) for r in matched],
    }


def _top_fornecedores_ultimos_dias(seg: str, data_referencia: datetime.date, dias: int = 3) -> list[dict]:
    # DDE nao varia por dia na tabela do HTML legado (sempre o snapshot atual
    # de D.DDE_FORN_MAP, dash 26.06.html linha 2760) - mesma fonte usada em
    # get_fornecedores().
    dde_by_forn = {
        r.get("nome_fantasia_fornecedor"): r.get("dias_estoque") for r in raw_data.get_dde_fornecedor(data_referencia)
    }
    datas = [data_referencia - datetime.timedelta(days=i) for i in range(dias)]
    por_forn: dict[str, dict[datetime.date, dict]] = {}
    for d in datas:
        agg: dict[str, dict] = {}
        for r in raw_data.get_planilha_geral(d):
            if norm_seg(r.get("segmento")) != seg:
                continue
            forn = r.get("nome_fantasia_fornecedor") or ""
            if not forn:
                continue
            valor = r.get("ruptura_valor_venda") or 0.0
            percentual = normalize_percentual(r.get("ruptura_percentual") or 0.0)
            entry = agg.setdefault(forn, {"valor": 0.0, "pv_acumulado": 0.0})
            entry["valor"] += valor
            entry["pv_acumulado"] += percentual * valor
        for forn, vals in agg.items():
            valor = vals["valor"]
            pct = (vals["pv_acumulado"] / valor) if valor > 0 else 0.0
            por_forn.setdefault(forn, {})[d] = {"valor": valor, "percentual": pct}

    ranked = sorted(
        por_forn.items(),
        key=lambda kv: kv[1].get(data_referencia, {}).get("valor", 0.0),
        reverse=True,
    )[:10]
    return [
        {
            "fornecedor": forn,
            "dde": dde_by_forn.get(forn),
            "dias": [
                {"data": d, "valor": dias_map[d]["valor"], "percentual": dias_map[d]["percentual"]}
                for d in datas
                if d in dias_map
            ],
        }
        for forn, dias_map in ranked
    ]


def _segmento_series_pontos(
    seg: str, inicio: datetime.date, fim: datetime.date, com_cd: bool
) -> list[dict]:
    grafico_rows = (
        raw_data.get_planilha_grafico_cd_range(inicio, fim)
        if com_cd
        else raw_data.get_planilha_grafico_range(inicio, fim)
    )
    dde_by_date = {
        r["data_referencia"]: r.get("dias_estoque")
        for r in raw_data.get_dde_segmento_range(inicio, fim)
        if norm_seg(r.get("segmento")) == seg
    }
    pontos = [
        {
            "data": r["data_referencia"],
            "valor": r.get("ruptura_valor_venda") or 0.0,
            "percentual": normalize_percentual(r.get("ruptura_percentual") or 0.0),
            "dde": dde_by_date.get(r["data_referencia"]),
        }
        for r in grafico_rows
        if norm_seg(r.get("segmento")) == seg
    ]
    pontos.sort(key=lambda p: p["data"])
    return pontos


def get_segmento_series(
    segmento: str, data_referencia: datetime.date, dias: int = 30, com_cd: bool = False
) -> dict:
    """dias=0 e o modo "mes atual" (padrao da aba Ruptura Segmentos no HTML
    legado, RS_DAYS=0): usa do dia 1 do mes de data_referencia ate hoje, com
    fallback para uma janela rolante de 31 dias se o mes corrente nao tiver
    nenhum ponto (mesma regra do `selRS()` original, dash 26.06.html linhas
    2560-2569)."""
    seg = norm_seg(segmento)
    if dias == 0:
        inicio = data_referencia.replace(day=1)
        pontos = _segmento_series_pontos(seg, inicio, data_referencia, com_cd)
        if not pontos:
            inicio = data_referencia - datetime.timedelta(days=31)
            pontos = _segmento_series_pontos(seg, inicio, data_referencia, com_cd)
    else:
        inicio = data_referencia - datetime.timedelta(days=dias - 1)
        pontos = _segmento_series_pontos(seg, inicio, data_referencia, com_cd)

    return {"dias": dias, "com_cd": com_cd, "pontos": pontos}


def get_segmento_detail(data_referencia: datetime.date, segmento: str) -> dict:
    seg = norm_seg(segmento)
    vals = get_segmentos_today(data_referencia).get(seg, {"valor": 0.0, "percentual": 0.0})
    meta = SEG_METAS.get(seg)
    acima = meta is not None and vals["percentual"] > meta

    dde_row = next(
        (r for r in raw_data.get_dde_segmento(data_referencia) if norm_seg(r.get("segmento")) == seg), None
    )

    bridge_resp = get_bridge(data_referencia, mode="segmento", chave=seg)
    bridge_rows_seg = _bridge_filtered_rows(data_referencia, "segmento", seg)

    return {
        "data_referencia": data_referencia,
        "segmento": seg,
        "percentual": vals["percentual"],
        "valor": vals["valor"],
        "meta_percentual": meta,
        "acima_meta": acima,
        "dde": dde_row.get("dias_estoque") if dde_row else None,
        "dde_meta": get_dde_meta(seg, data_referencia),
        "cor": "#e05555" if acima else segmento_color(seg),
        "bridge": bridge_resp["statuses"],
        "critico_estimado": {
            "pp": round(vals["percentual"] * CRIT_LEGACY_FACTOR, 4),
            "valor": round(vals["valor"] * CRIT_LEGACY_FACTOR, 2),
        },
        "item_critico": _pick_item_critico(bridge_rows_seg),
        "top_fornecedores_ultimos_dias": _top_fornecedores_ultimos_dias(seg, data_referencia, dias=3),
    }
