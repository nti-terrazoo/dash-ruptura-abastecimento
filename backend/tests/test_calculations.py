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
    assert norm_seg("PETFOOD") == "PET FOOD"
    assert norm_seg("PET FOOD") == "PET FOOD"
    assert norm_seg("Farmácia") == "PET FARMACIA"
    assert norm_seg("PET AQUARISMO") == "PET AQUARISMO"
    assert norm_seg("PET Fauna") == "PET FAUNA"  # alias casa case-insensitive
    assert norm_seg("PET Novidade") == "PET NOVIDADE"  # sem alias -> so remove prefixo "PET "
    assert norm_seg("JARDINAGEM") == "JARDINAGEM"
    assert norm_seg("") == ""
    assert norm_seg(None) == ""


def test_normalize_percentual_treats_fraction_as_percent():
    assert normalize_percentual(0.135) == pytest.approx(13.5)
    assert normalize_percentual(13.5) == 13.5
    assert normalize_percentual(0) == 0
    assert normalize_percentual(None) == 0.0


_META_ROW = {
    "segmento": "PET FARMACIA",
    "jan_01": None, "fev_02": 0, "mar_03": 118, "abr_04": 117, "mai_05": 115, "jun_06": 113,
    "jul_07": 111, "ago_08": 110, "set_09": 108, "out_10": 108, "nov_11": 0, "dez_12": 108,
}


@pytest.mark.parametrize(
    "mes,esperado",
    [
        (1, 118),  # janeiro nulo -> usa marco
        (2, 118),  # fevereiro 0 -> usa marco
        (3, 118),
        (4, 117),
        (11, None),  # mes sem meta (0) fora de jan/fev -> sem meta
        (12, 108),
    ],
)
def test_get_dde_meta_por_mes(mes, esperado):
    assert get_dde_meta(_META_ROW, datetime.date(2026, mes, 15)) == esperado


def test_get_dde_meta_janeiro_com_valor_proprio():
    row = {**_META_ROW, "jan_01": 120}
    assert get_dde_meta(row, datetime.date(2026, 1, 15)) == 120


def test_get_dde_meta_sem_linha_do_segmento_returns_none():
    assert get_dde_meta(None, datetime.date(2026, 7, 6)) is None


@pytest.mark.parametrize(
    "percentual,esperado",
    [(0, "OK"), (10, "OK"), (10.01, "Atenção"), (15, "Atenção"), (15.01, "Alerta"), (25, "Alerta"), (25.01, "Crítico")],
)
def test_loja_status_thresholds(percentual, esperado):
    assert loja_status(percentual) == esperado


@pytest.mark.parametrize(
    "percentual,esperado_cor",
    [(0, "#5ed9a0"), (15, "#5ed9a0"), (15.01, "#ffd166"), (30, "#ffd166"), (30.01, "#ff6b6b")],
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


def test_match_bridge_status_pedido_parcial_tem_prioridade_sobre_com_pedido():
    # "Situacao Critica - Pedido Parcial" contem "- Pedido" e tambem seria
    # capturado pelas keys genericas de "Sit. Critica c/ Pedido" se a ordem de
    # casamento nao desse prioridade a "Pedido Parcial" (ver
    # arquivos_originais/melhoria_pedido_parcial_bridge_cd.md, secao 4).
    assert (
        match_bridge_status("Situação Crítica - Pedido Parcial")["label"]
        == "Sit. Crítica p/ Pedido"
    )
    assert match_bridge_status("SITUACAO CRITICA - PEDIDO PARCIAL")["label"] == "Sit. Crítica p/ Pedido"


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
    assert len(statuses) == 6
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


def test_dde_meta_do_service_exige_linha_do_ano_da_referencia():
    from unittest.mock import patch

    from app.services import dashboard_service

    rows = [{**_META_ROW, "ano": 2025, "out_10": 200}, {**_META_ROW, "ano": 2026}]
    with patch("app.services.raw_data.get_metas_segmento", return_value=rows):
        assert dashboard_service._get_dde_meta("PET FARMACIA", datetime.date(2026, 10, 1)) == 108
        assert dashboard_service._get_dde_meta("PET FARMACIA", datetime.date(2025, 10, 1)) == 200
        assert dashboard_service._get_dde_meta("PET FARMACIA", datetime.date(2027, 10, 1)) is None


def test_get_metas_dde_lista_so_o_ano_e_marca_heranca_de_marco():
    from unittest.mock import patch

    from app.services import dashboard_service

    rows = [{**_META_ROW, "ano": 2025}, {**_META_ROW, "ano": 2026, "fev_02": 120}]
    with patch("app.services.raw_data.get_metas_segmento", return_value=rows):
        resp = dashboard_service.get_metas_dde(datetime.date(2026, 10, 22))
    assert resp["ano"] == 2026 and len(resp["segmentos"]) == 1
    jan, fev, *_ = resp["segmentos"][0]["meses"]
    assert jan == {"mes": 1, "cadastrada": None, "aplicada": 118, "herdada_de_marco": True}
    assert fev == {"mes": 2, "cadastrada": 120, "aplicada": 120, "herdada_de_marco": False}
