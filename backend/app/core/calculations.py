"""Calculos de negocio portados do dashboard legado (processData() no HTML).

Como o Oracle ja entrega tipos nativos (NUMBER/DATE), nao precisamos replicar
as heuristicas de parsing de numero/data BR-vs-US do JS original (toNum/
toDate) - essa era uma fonte de bugs do sistema antigo e desaparece ao ler
direto do banco em vez de um CSV do Google Sheets.
"""

from app.core.business_rules import (
    BRIDGE_FALLBACK_PROPORTIONS,
    BRIDGE_STATUS_DEFS,
    match_bridge_status,
)


def normalize_percentual(valor: float) -> float:
    """Defensivo: caso a view retorne fracao (0-1) em vez de 0-100, normaliza.
    Equivalente ao colPct() do JS original."""
    if valor is None:
        return 0.0
    if 0 < valor < 1:
        return valor * 100
    return valor


def aggregate_bridge_status_totals(itens: list[dict]) -> dict[str, float]:
    """Soma RUPTURA_VALOR_VENDA por status da bridge (casado via substring em
    SITUACAO), ignorando itens sem status reconhecido ou com valor <= 0."""
    totals: dict[str, float] = {d["label"]: 0.0 for d in BRIDGE_STATUS_DEFS}
    for item in itens:
        valor = item.get("valor") or 0.0
        if valor <= 0:
            continue
        status_def = match_bridge_status(item.get("situacao", ""))
        if status_def is None:
            continue
        totals[status_def["label"]] += valor
    return totals


def split_bridge_by_official_total(
    status_totals: dict[str, float],
    official_valor: float,
    official_pct: float,
) -> list[dict]:
    """Reparte o valor/percentual OFICIAL (vindo da view de referencia - geral,
    loja ou segmento) entre os 5 status da bridge, usando a PROPORCAO interna
    da bridge (status/total_bridge). O ultimo status fecha o resto por
    subtracao para o total bater exatamente com o oficial, sem erro de
    arredondamento acumulado. Replica fielmente D.BRIDGE / BRIDGE_BY_LOJA /
    BRIDGE_BY_SEG do HTML original (mesma formula para os tres casos).

    Se nao houver nenhum item real de bridge (total_bridge <= 0), usa as
    proporcoes fixas de fallback herdadas do dashboard antigo.
    """
    total_bridge = sum(status_totals.values())
    n = len(BRIDGE_STATUS_DEFS)
    results: list[dict] = []

    if total_bridge <= 0:
        for status_def, prop in zip(BRIDGE_STATUS_DEFS, BRIDGE_FALLBACK_PROPORTIONS):
            results.append({
                "label": status_def["label"],
                "color": status_def["color"],
                "valor": round(official_valor * prop, 2),
                "pp": round(official_pct * prop, 2),
            })
        return results

    acc_valor = 0.0
    acc_pp = 0.0
    for i, status_def in enumerate(BRIDGE_STATUS_DEFS):
        proporcao = status_totals.get(status_def["label"], 0.0) / total_bridge
        if i < n - 1:
            valor = round(proporcao * official_valor, 2)
            pp = round(proporcao * official_pct, 2)
            acc_valor += valor
            acc_pp += pp
        else:
            valor = round(official_valor - acc_valor, 2)
            pp = round(official_pct - acc_pp, 2)
        results.append({"label": status_def["label"], "color": status_def["color"], "valor": valor, "pp": pp})
    return results
