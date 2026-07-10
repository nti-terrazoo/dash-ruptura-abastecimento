import datetime

import pytest

from app.core.business_rules import (
    fornecedor_color,
    get_dde_meta,
    is_excluded_store,
    loja_status,
    match_bridge_status,
    norm_seg,
)
from app.core.calculations import (
    aggregate_bridge_status_totals,
    normalize_percentual,
    split_bridge_by_official_total,
)


def test_norm_seg_aliases_and_pet_prefix():
    assert norm_seg("PETFOOD") == "FOOD"
    assert norm_seg("PET FOOD") == "FOOD"
    assert norm_seg("Farmácia") == "FARMACIA"
    assert norm_seg("PET AQUARISMO") == "AQUARISMO"
    assert norm_seg("PET Fauna") == "FAUNA"  # alias casa case-insensitive
    assert norm_seg("PET Novidade") == "Novidade"  # sem alias -> so remove prefixo "PET "
    assert norm_seg("JARDINAGEM") == "JARDINAGEM"
    assert norm_seg("") == ""
    assert norm_seg(None) == ""


def test_normalize_percentual_treats_fraction_as_percent():
    assert normalize_percentual(0.135) == pytest.approx(13.5)
    assert normalize_percentual(13.5) == 13.5
    assert normalize_percentual(0) == 0
    assert normalize_percentual(None) == 0.0


@pytest.mark.parametrize(
    "mes,esperado",
    [
        (1, 118),  # antes de marco -> clamp no primeiro valor
        (2, 118),
        (3, 118),  # marco -> indice 0
        (4, 117),  # abril -> indice 1
        (12, 108),  # dezembro -> indice 9 (ultimo)
        (12, 108),
    ],
)
def test_get_dde_meta_clamps_outside_range(mes, esperado):
    referencia = datetime.date(2026, mes, 15)
    assert get_dde_meta("FARMACIA", referencia) == esperado


def test_get_dde_meta_unknown_segment_returns_none():
    assert get_dde_meta("SEGMENTO_INEXISTENTE", datetime.date(2026, 7, 6)) is None


@pytest.mark.parametrize(
    "percentual,esperado",
    [(0, "OK"), (10, "OK"), (10.01, "Atenção"), (15, "Atenção"), (15.01, "Alerta"), (25, "Alerta"), (25.01, "Crítico")],
)
def test_loja_status_thresholds(percentual, esperado):
    assert loja_status(percentual) == esperado


@pytest.mark.parametrize(
    "percentual,esperado_cor",
    [(0, "#2d6b4a"), (15, "#2d6b4a"), (15.01, "#c87010"), (30, "#c87010"), (30.01, "#e05555")],
)
def test_fornecedor_color_thresholds(percentual, esperado_cor):
    assert fornecedor_color(percentual) == esperado_cor


def test_is_excluded_store_by_prefix_case_insensitive():
    assert is_excluded_store("terrazoo cd")
    assert is_excluded_store("CD SUDESTE")
    assert is_excluded_store("LYNKZ BR - FILIAL 1")
    assert not is_excluded_store("LOJA CENTRO")


def test_match_bridge_status_substring_case_insensitive():
    assert match_bridge_status("Situação Crítica - Pedido Pendente")["label"] == "Sit. Crítica c/ Pedido"
    assert match_bridge_status("cd atende loja - prenota")["label"] == "CD Atende Loja"
    assert match_bridge_status("estoque negativo")["label"] == "Estoque Negativo"
    assert match_bridge_status("texto sem correspondencia nenhuma") is None
    assert match_bridge_status("") is None


def test_aggregate_bridge_status_totals_ignores_unmatched_and_non_positive():
    itens = [
        {"valor": 100.0, "situacao": "CD Atende Loja"},
        {"valor": 50.0, "situacao": "cd atende loja"},
        {"valor": -10.0, "situacao": "CD Atende Loja"},  # ignorado: valor <= 0
        {"valor": 30.0, "situacao": "texto desconhecido"},  # ignorado: sem match
        {"valor": 20.0, "situacao": "Estoque Negativo"},
    ]
    totals = aggregate_bridge_status_totals(itens)
    assert totals["CD Atende Loja"] == pytest.approx(150.0)
    assert totals["Estoque Negativo"] == pytest.approx(20.0)
    assert totals["Sit. Crítica c/ Pedido"] == 0.0


def test_split_bridge_by_official_total_fallback_when_no_real_items():
    statuses = split_bridge_by_official_total({}, official_valor=1000.0, official_pct=10.0)
    assert len(statuses) == 5
    total_valor = sum(s["valor"] for s in statuses)
    total_pp = sum(s["pp"] for s in statuses)
    assert total_valor == pytest.approx(1000.0)
    assert total_pp == pytest.approx(10.0)
    # primeira categoria usa a proporcao de fallback 0.400
    assert statuses[0]["valor"] == pytest.approx(400.0)


def test_split_bridge_by_official_total_real_data_last_status_closes_remainder():
    status_totals = {
        "Sit. Crítica c/ Pedido": 300.0,
        "Sit. Crítica s/ Pedido": 100.0,
        "CD Insuficiente": 50.0,
        "CD Atende Loja": 40.0,
        "Estoque Negativo": 10.0,
    }
    # total_bridge = 500, official_valor difere do total_bridge (como no real,
    # onde a bridge e uma amostra e o total oficial vem de outra view)
    statuses = split_bridge_by_official_total(status_totals, official_valor=987.65, official_pct=13.37)

    total_valor = sum(s["valor"] for s in statuses)
    total_pp = sum(s["pp"] for s in statuses)
    # fechamento exato: soma das partes bate com o total oficial, mesmo com
    # arredondamento de cada parte em 2 casas decimais
    assert total_valor == pytest.approx(987.65, abs=0.01)
    assert total_pp == pytest.approx(13.37, abs=0.0001)

    # primeiro status = 300/500 = 60% do oficial
    assert statuses[0]["valor"] == pytest.approx(987.65 * 0.6, abs=0.01)
