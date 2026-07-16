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

    # Compara pela forma normalizada (norm_seg) em vez de string exata: as
    # chaves de "result" sao o segmento cru da view (com "PET" preservado),
    # que pode nao bater byte-a-byte com VALID_SEGMENTOS mesmo quando e o
    # mesmo segmento (ex. grafia/espacamento diferente entre views).
    covered = {norm_seg(s) for s in result}
    missing = [s for s in VALID_SEGMENTOS if s not in covered]
    if missing:
        agg: dict[str, dict] = {}
        for row in raw_data.get_planilha_geral(data_referencia):
            seg = row.get("segmento")
            if norm_seg(seg) not in missing:
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
        meta = SEG_METAS.get(norm_seg(seg))
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


# ══ COMITE — APRESENTACAO (PPTX) ═══════════════════════════════════════
# Agrega tudo que o frontend precisa num unico payload,
# reaproveitando os services ja existentes (nada e recalculado do zero)

CURVAS = ("A", "B", "C", "D")
CURVAS_ABC_HISTORY_DIAS = 60


def get_curvas_abc(data_referencia: datetime.date, dias: int = CURVAS_ABC_HISTORY_DIAS) -> dict:
    """Ruptura por curva ABC (A/B/C/D) agregada por dia. Fonte: queries 13
    (VW_DASH_ARQ_01_CURCA, ja agregada por curva no proprio Oracle via
    queries.CURVAS_ABC_AGREGADO_RANGE) e 14 (VW_DASH_ARQ_02_CURCA, ruptura
    geral do dia usada para repartir "pp"/"valor" proporcionalmente entre as
    curvas - equivalente ao _raw10/av_ do dash_2.html). Substitui o upload
    manual de planilhas do Comite legado por consulta direta ao banco.
    Produto sem classificacao em DASH_RUPTURA_PROD_CURVA cai na curva D (a
    regra e aplicada na propria query via NVL, nao aqui)."""
    inicio = data_referencia - datetime.timedelta(days=dias - 1)
    agg_rows = raw_data.get_curvas_abc_agregado_range(inicio, data_referencia)
    aux_rows = raw_data.get_arq02_curva_range(inicio, data_referencia)

    por_data: dict[datetime.date, dict[str, dict]] = {}
    for row in agg_rows:
        data = row["data_referencia"]
        curva = (row.get("classificacao") or "D").strip().upper()
        if curva not in CURVAS:
            curva = "D"
        entry = por_data.setdefault(data, {c: {"ruptura": 0.0, "potencial": 0.0} for c in CURVAS})
        entry[curva]["ruptura"] += row.get("ruptura_valor_venda") or 0.0
        entry[curva]["potencial"] += row.get("potencial") or 0.0

    aux_by_data = {
        row["data_referencia"]: {
            "valor": row.get("ruptura_valor_venda") or 0.0,
            "percentual": normalize_percentual(row.get("ruptura_percentual") or 0.0),
        }
        for row in aux_rows
    }

    pontos: dict[str, list[dict]] = {c: [] for c in CURVAS}
    for data in sorted(por_data):
        grupos = por_data[data]
        ruptura_total = sum(g["ruptura"] for g in grupos.values())
        aux = aux_by_data.get(data)
        for c in CURVAS:
            g = grupos[c]
            pct = (g["ruptura"] / g["potencial"] * 100) if g["potencial"] > 0 else 0.0
            pp = valor = None
            if aux is not None:
                share = (g["ruptura"] / ruptura_total) if ruptura_total > 0 else 0.0
                pp = round(aux["percentual"] * share, 2)
                valor = round(aux["valor"] * share, 2)
            pontos[c].append({"data": data, "pct": round(pct, 4), "pp": pp, "valor": valor})

    disponivel = any(pontos[c] for c in CURVAS)
    return {"disponivel": disponivel, "pontos": pontos}


def _comite_segmento(
    seg: str,
    data_referencia: datetime.date,
    seg_today_by_norm: dict[str, dict],
    seg_cd_today_by_norm: dict[str, dict],
) -> dict:
    vals = seg_today_by_norm.get(seg, {"valor": 0.0, "percentual": 0.0})
    vals_cd = seg_cd_today_by_norm.get(seg, {"valor": 0.0, "percentual": 0.0})
    meta = SEG_METAS.get(seg)
    acima = meta is not None and vals["percentual"] > meta
    dde_row = next(
        (r for r in raw_data.get_dde_segmento(data_referencia) if norm_seg(r.get("segmento")) == seg), None
    )
    bridge_resp = get_bridge(data_referencia, mode="segmento", chave=seg)
    fornecedores = get_fornecedores(data_referencia, segmento=seg)["ranking"][:10]
    serie = get_segmento_series(seg, data_referencia, dias=15, com_cd=False)["pontos"]
    serie_cd = get_segmento_series(seg, data_referencia, dias=15, com_cd=True)["pontos"]
    inicio_15 = data_referencia - datetime.timedelta(days=14)
    serie_dde = sorted(
        (
            {"data": r["data_referencia"], "valor": r.get("dias_estoque")}
            for r in raw_data.get_dde_segmento_range(inicio_15, data_referencia)
            if norm_seg(r.get("segmento")) == seg
        ),
        key=lambda p: p["data"],
    )

    return {
        "segmento": seg,
        "meta": meta,
        "acima_meta": acima,
        "cor": "#e05555" if acima else segmento_color(seg),
        "percentual": vals["percentual"],
        "valor": vals["valor"],
        "percentual_cd": vals_cd["percentual"],
        "valor_cd": vals_cd["valor"],
        "dde": dde_row.get("dias_estoque") if dde_row else None,
        "dde_meta": get_dde_meta(seg, data_referencia),
        "bridge": bridge_resp["statuses"],
        "top_fornecedores": fornecedores,
        "serie": serie,
        "serie_cd": serie_cd,
        "serie_dde": serie_dde,
    }


def get_comite(data_referencia: datetime.date) -> dict:
    """Payload completo para a Apresentacao Comite - a data usada e sempre a
    data de referencia selecionada na sidebar (nao ha selecao propria na
    tela do Comite)."""
    overview = get_overview(data_referencia)

    seg_today_by_norm = {norm_seg(seg): vals for seg, vals in get_segmentos_today(data_referencia).items()}
    seg_cd_today_by_norm = {
        norm_seg(row.get("segmento")): {
            "percentual": normalize_percentual(row.get("ruptura_percentual") or 0.0),
            "valor": row.get("ruptura_valor_venda") or 0.0,
        }
        for row in raw_data.get_planilha_grafico_cd(data_referencia)
    }

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(VALID_SEGMENTOS)) as executor:
        segmentos = list(
            executor.map(
                lambda seg: _comite_segmento(seg, data_referencia, seg_today_by_norm, seg_cd_today_by_norm),
                VALID_SEGMENTOS,
            )
        )

    lojas = get_lojas(data_referencia)["lojas"]
    lojas_criticas_ord = sorted(
        (l for l in lojas if l["percentual"] > 10), key=lambda l: l["percentual"], reverse=True
    )
    loja_critica_row = lojas_criticas_ord[0] if lojas_criticas_ord else (lojas[0] if lojas else None)
    loja_critica = (
        get_loja_detail(data_referencia, loja_critica_row["cod_unidade"]) if loja_critica_row else None
    )

    inicio_15 = data_referencia - datetime.timedelta(days=14)
    dde_geral_serie = [
        {"data": r["data_referencia"], "valor": r.get("dias_estoque")}
        for r in raw_data.get_dde_geral_range(inicio_15, data_referencia)
    ]
    # Nao ha uma meta de DDE geral real (so por segmento) - o legado usa
    # PET FOOD como proxy pra linha de referencia do grafico geral, com
    # fallback 96 (dash_2.html, gerarPPTX(): "ddeMetaGeral").
    dde_meta_geral = get_dde_meta("PET FOOD", data_referencia) or 96

    # Fornecedores com MENOR DDE (giro mais rapido/risco de ruptura) - usado
    # no card de DDE Geral do PPTX (dash_2.html, gerarPPTX(): "top3DDE").
    # Diferente de overview["top_fornecedores_dde"], que e ordenado de forma
    # DESCENDENTE (maior DDE primeiro) para outro proposito na Visao Geral.
    top_fornecedores_dde_baixo = sorted(
        (
            {"fornecedor": r.get("nome_fantasia_fornecedor"), "dde": r["dias_estoque"]}
            for r in raw_data.get_dde_fornecedor(data_referencia)
            if r.get("dias_estoque") and 0 < r["dias_estoque"] <= 400
        ),
        key=lambda x: x["dde"],
    )[:3]

    return {
        "data_referencia": data_referencia,
        "meta_percentual": 10.0,
        "ruptura_sem_cd": overview["ruptura_sem_cd"],
        "ruptura_com_cd": overview["ruptura_com_cd"],
        "dde_geral": overview["dde_geral"],
        "top_fornecedores_dde": top_fornecedores_dde_baixo,
        "serie_geral": get_series(data_referencia, dias=15, com_cd=False)["pontos"],
        "serie_geral_cd": get_series(data_referencia, dias=15, com_cd=True)["pontos"],
        "dde_geral_serie": dde_geral_serie,
        "dde_meta_geral": dde_meta_geral,
        "bridge_geral": get_bridge(data_referencia, mode="geral")["statuses"],
        "segmentos": segmentos,
        "lojas": lojas,
        "loja_critica": loja_critica,
        "curvas": get_curvas_abc(data_referencia),
    }


# Meta geral de ruptura usada no briefing (igual ao resto do dashboard) e o
# fallback de meta por segmento quando o segmento nao esta em SEG_METAS -
# replica `SEG_METAS[x]||10` do HTML legado (dash_2.html, renderBriefing()).
BRIEFING_META_GERAL = 10.0
BRIEFING_META_SEGMENTO_FALLBACK = 10.0

# Threshold de variacao dia-a-dia (pontos percentuais) para classificar a
# tendencia como alta/queda em vez de estavel - igual ao HTML legado.
BRIEFING_TENDENCIA_THRESHOLD = 0.5

# Loja e considerada critica no briefing acima de 15% (diferente do badge
# "Crítico" do resto do app, que e >25% - e um limiar proprio do briefing no
# HTML legado, mantido por fidelidade).
BRIEFING_LOJA_CRITICA_THRESHOLD = 15.0


def _briefing_loja(loja: dict) -> dict:
    return {
        "nome": loja["nome"],
        "cod_unidade": loja["cod_unidade"],
        "percentual": loja["percentual"],
        "valor": loja["valor"],
    }


def get_briefing(data_referencia: datetime.date) -> dict:
    """Dados do "Briefing 9h": um resumo executivo com os principais pontos
    de atencao do dia, para a reuniao matinal. Reaproveita os mesmos
    services/regras do resto do dashboard (nao recalcula nada do zero) -
    ver relatorio de analise do dash_2.html para a origem de cada regra.
    Numeros crus, sem formatacao - o frontend monta o texto final."""
    dia_2d = get_series(data_referencia, dias=2, com_cd=False)["pontos"]
    hoje = dia_2d[-1] if dia_2d else {"valor": 0.0, "percentual": 0.0}
    ontem = dia_2d[-2] if len(dia_2d) >= 2 else hoje

    delta_pct = hoje["percentual"] - ontem["percentual"]
    if delta_pct > BRIEFING_TENDENCIA_THRESHOLD:
        tendencia = "alta"
    elif delta_pct < -BRIEFING_TENDENCIA_THRESHOLD:
        tendencia = "queda"
    else:
        tendencia = "estavel"

    dde_rows = raw_data.get_dde_geral(data_referencia)
    dde_geral = dde_rows[0]["dias_estoque"] if dde_rows else None

    seg_today = get_segmentos_today(data_referencia)
    segmentos_hoje = [{"segmento": seg, **vals} for seg, vals in seg_today.items()]
    segmento_critico = max(segmentos_hoje, key=lambda s: s["percentual"], default=None)
    segmentos_acima_meta = sum(
        1
        for s in segmentos_hoje
        if s["percentual"] > SEG_METAS.get(norm_seg(s["segmento"]), BRIEFING_META_SEGMENTO_FALLBACK)
    )
    segmento_critico_meta = (
        SEG_METAS.get(norm_seg(segmento_critico["segmento"]), BRIEFING_META_SEGMENTO_FALLBACK)
        if segmento_critico
        else None
    )

    bridge = get_bridge(data_referencia, mode="geral")
    sem_pedido = next((s for s in bridge["statuses"] if s["label"] == "Sit. Crítica s/ Pedido"), None)
    cd_atende = next((s for s in bridge["statuses"] if s["label"] == "CD Atende Loja"), None)

    lojas = get_lojas(data_referencia)["lojas"]
    lojas_criticas = sorted(
        (l for l in lojas if l["percentual"] > BRIEFING_LOJA_CRITICA_THRESHOLD),
        key=lambda l: l["percentual"],
        reverse=True,
    )[:3]
    candidatos_melhor = sorted((l for l in lojas if l["percentual"] <= BRIEFING_META_GERAL), key=lambda l: l["percentual"])
    melhor_loja = candidatos_melhor[0] if candidatos_melhor else None
    # A "loja mais critica" do resumo e a de maior VALOR em ruptura (nao
    # necessariamente maior %) - mesma semantica de D.LOJAS[0] no legado.
    pior_loja = max(lojas, key=lambda l: l["valor"], default=None)

    ranking_fornecedores = get_fornecedores(data_referencia, segmento="TODOS")["ranking"]
    top_fornecedor = max(ranking_fornecedores, key=lambda f: f["valor"], default=None)

    bridge_rows = _valid_bridge_rows(raw_data.get_lojas_bridge(data_referencia))
    itens_sem_pedido = sorted(
        (r for r in bridge_rows if (match_bridge_status(r.get("situacao")) or {}).get("label") == "Sit. Crítica s/ Pedido"),
        key=lambda r: r.get("ruptura_valor_venda") or 0.0,
        reverse=True,
    )[:3]

    pautas = []
    if sem_pedido and sem_pedido["valor"] > 0:
        pautas.append({"tipo": "sem_pedido", "cor": "#c0392b", "valor": sem_pedido["valor"]})
    if pior_loja and pior_loja["percentual"] > BRIEFING_LOJA_CRITICA_THRESHOLD:
        pautas.append(
            {"tipo": "loja_critica", "cor": "#c0392b", "nome": pior_loja["nome"], "percentual": pior_loja["percentual"]}
        )
    if segmento_critico and segmento_critico["percentual"] > segmento_critico_meta:
        pautas.append(
            {
                "tipo": "segmento_meta",
                "cor": "#b8860b",
                "nome": segmento_critico["segmento"],
                "percentual": segmento_critico["percentual"],
                "meta": segmento_critico_meta,
            }
        )
    if top_fornecedor and top_fornecedor["valor"] > 0:
        pautas.append({"tipo": "fornecedor", "cor": "#b8860b", "nome": top_fornecedor["fornecedor"], "valor": top_fornecedor["valor"]})
    if cd_atende and cd_atende["valor"] > 0:
        pautas.append({"tipo": "cd_atende", "cor": "#1f8a4c", "valor": cd_atende["valor"]})

    return {
        "data_referencia": data_referencia,
        "ruptura_percentual": hoje["percentual"],
        "ruptura_valor": hoje["valor"],
        "ruptura_percentual_anterior": ontem["percentual"],
        "tendencia": tendencia,
        "meta_percentual": BRIEFING_META_GERAL,
        "acima_meta_geral": hoje["percentual"] > BRIEFING_META_GERAL,
        "sem_pedido_valor": sem_pedido["valor"] if sem_pedido else 0.0,
        "cd_atende_valor": cd_atende["valor"] if cd_atende else 0.0,
        "dde_geral": dde_geral,
        "segmento_critico": segmento_critico["segmento"] if segmento_critico else None,
        "segmento_critico_percentual": segmento_critico["percentual"] if segmento_critico else None,
        "segmento_critico_meta": segmento_critico_meta,
        "segmentos_acima_meta": segmentos_acima_meta,
        "lojas_criticas": [_briefing_loja(l) for l in lojas_criticas],
        "melhor_loja": _briefing_loja(melhor_loja) if melhor_loja else None,
        "itens_sem_pedido": [
            {
                "produto": r.get("descricao_produto"),
                "loja": r.get("nome_fantasia_loja"),
                "valor": r.get("ruptura_valor_venda") or 0.0,
            }
            for r in itens_sem_pedido
        ],
        "pautas": pautas,
    }
