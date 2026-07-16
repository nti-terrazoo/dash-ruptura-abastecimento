import datetime
from unittest.mock import patch

from app.services.dashboard_service import get_comite, get_curvas_abc

DATA_REF = datetime.date(2026, 7, 6)


def test_get_curvas_abc_agrega_por_dia_e_reparte_proporcional():
    agg_rows = [
        {"data_referencia": DATA_REF, "classificacao": "A", "ruptura_valor_venda": 100.0, "potencial": 1000.0},
        {"data_referencia": DATA_REF, "classificacao": "D", "ruptura_valor_venda": 300.0, "potencial": 1000.0},
    ]
    aux_rows = [{"data_referencia": DATA_REF, "ruptura_valor_venda": 40000.0, "ruptura_percentual": 0.12}]
    with patch("app.services.raw_data.get_curvas_abc_agregado_range", return_value=agg_rows), patch(
        "app.services.raw_data.get_arq02_curva_range", return_value=aux_rows
    ):
        result = get_curvas_abc(DATA_REF, dias=1)

    assert result["disponivel"] is True
    a_ponto = result["pontos"]["A"][0]
    d_ponto = result["pontos"]["D"][0]
    assert a_ponto["pct"] == 10.0  # 100/1000*100
    assert d_ponto["pct"] == 30.0  # 300/1000*100
    # ruptura total do dia = 100+300=400 -> share A=0.25, share D=0.75;
    # av (ruptura_percentual=0.12 normalizado -> 12%) repartido pela share.
    assert a_ponto["pp"] == round(12.0 * 0.25, 2)
    assert d_ponto["pp"] == round(12.0 * 0.75, 2)
    assert a_ponto["valor"] == round(40000.0 * 0.25, 2)
    assert d_ponto["valor"] == round(40000.0 * 0.75, 2)
    # B/C nao tiveram nenhum produto no dia, mas o dia tem aux -> pp/valor=0, nao None
    assert result["pontos"]["B"][0]["pct"] == 0.0
    assert result["pontos"]["B"][0]["pp"] == 0.0
    assert result["pontos"]["B"][0]["valor"] == 0.0


def test_get_curvas_abc_sem_dados_retorna_indisponivel():
    with patch("app.services.raw_data.get_curvas_abc_agregado_range", return_value=[]), patch(
        "app.services.raw_data.get_arq02_curva_range", return_value=[]
    ):
        result = get_curvas_abc(DATA_REF, dias=1)

    assert result["disponivel"] is False
    assert all(result["pontos"][c] == [] for c in ("A", "B", "C", "D"))


def test_get_curvas_abc_dia_sem_arq02_nao_calcula_pp_valor():
    agg_rows = [{"data_referencia": DATA_REF, "classificacao": "A", "ruptura_valor_venda": 50.0, "potencial": 500.0}]
    with patch("app.services.raw_data.get_curvas_abc_agregado_range", return_value=agg_rows), patch(
        "app.services.raw_data.get_arq02_curva_range", return_value=[]
    ):
        result = get_curvas_abc(DATA_REF, dias=1)

    ponto = result["pontos"]["A"][0]
    assert ponto["pct"] == 10.0
    assert ponto["pp"] is None
    assert ponto["valor"] is None


def test_get_curvas_abc_classificacao_desconhecida_cai_em_d():
    # produto com classificacao invalida/inesperada tambem cai em D, igual
    # ao produto sem classificacao nenhuma (a regra "sem produto -> D" em si
    # e aplicada via NVL na query, nao aqui - isso cobre o fallback defensivo
    # do lado Python para valores fora de A/B/C/D).
    agg_rows = [{"data_referencia": DATA_REF, "classificacao": "X", "ruptura_valor_venda": 10.0, "potencial": 100.0}]
    with patch("app.services.raw_data.get_curvas_abc_agregado_range", return_value=agg_rows), patch(
        "app.services.raw_data.get_arq02_curva_range", return_value=[]
    ):
        result = get_curvas_abc(DATA_REF, dias=1)

    assert result["pontos"]["D"][0]["pct"] == 10.0
    assert "X" not in result["pontos"]


def _loja(cod, nome, percentual, valor):
    return {"cod_unidade": cod, "nome": nome, "valor": valor, "percentual": percentual, "dde": 10.0,
            "status": "Crítico" if percentual > 10 else "OK", "cor": "#e05555" if percentual > 10 else "#2d6b4a"}


def test_get_comite_agrega_9_segmentos_e_escolhe_loja_critica():
    lojas = [_loja("1", "Loja A", 22.0, 900.0), _loja("2", "Loja B", 5.0, 50.0)]
    loja_detail = {
        "data_referencia": DATA_REF, "cod_unidade": "1", "nome": "Loja A", "percentual": 22.0, "valor": 900.0,
        "dde": 10.0, "status": "Crítico", "segmentos_ofensores": [], "top_itens": [],
    }
    with patch.multiple(
        "app.services.dashboard_service",
        get_overview=lambda *a, **k: {
            "ruptura_sem_cd": {"percentual": 12.0, "valor": 1000.0},
            "ruptura_com_cd": {"percentual": 9.0, "valor": 800.0},
            "dde_geral": 90.0,
            "top_fornecedores_dde": [],
        },
        get_segmentos_today=lambda *a, **k: {"PET FOOD": {"valor": 100.0, "percentual": 12.0}},
        get_bridge=lambda *a, **k: {"statuses": []},
        get_fornecedores=lambda *a, **k: {"ranking": []},
        get_segmento_series=lambda *a, **k: {"pontos": []},
        get_lojas=lambda *a, **k: {"lojas": lojas},
        get_loja_detail=lambda *a, **k: loja_detail,
        get_series=lambda *a, **k: {"pontos": []},
        get_curvas_abc=lambda *a, **k: {"disponivel": False, "pontos": {"A": [], "B": [], "C": [], "D": []}},
    ), patch("app.services.raw_data.get_planilha_grafico_cd", return_value=[]), patch(
        "app.services.raw_data.get_dde_segmento", return_value=[]
    ), patch("app.services.raw_data.get_dde_geral_range", return_value=[]), patch(
        "app.services.raw_data.get_dde_segmento_range", return_value=[]
    ), patch("app.services.raw_data.get_dde_fornecedor", return_value=[]):
        result = get_comite(DATA_REF)

    assert len(result["segmentos"]) == 9
    assert result["segmentos"][0]["segmento"] == "PET FOOD"
    assert result["segmentos"][0]["percentual"] == 12.0
    assert result["segmentos"][0]["meta"] == 8  # SEG_METAS['PET FOOD']
    assert result["segmentos"][0]["acima_meta"] is True
    # loja critica = maior % acima de 10%, nao a loja[0]
    assert result["loja_critica"]["cod_unidade"] == "1"
    assert result["curvas"]["disponivel"] is False


def test_get_comite_loja_critica_cai_para_primeira_loja_quando_ninguem_acima_da_meta():
    lojas = [_loja("2", "Loja B", 5.0, 50.0), _loja("3", "Loja C", 3.0, 30.0)]
    loja_detail = {
        "data_referencia": DATA_REF, "cod_unidade": "2", "nome": "Loja B", "percentual": 5.0, "valor": 50.0,
        "dde": 10.0, "status": "OK", "segmentos_ofensores": [], "top_itens": [],
    }
    with patch.multiple(
        "app.services.dashboard_service",
        get_overview=lambda *a, **k: {
            "ruptura_sem_cd": {"percentual": 5.0, "valor": 100.0},
            "ruptura_com_cd": {"percentual": 4.0, "valor": 80.0},
            "dde_geral": 90.0,
            "top_fornecedores_dde": [],
        },
        get_segmentos_today=lambda *a, **k: {},
        get_bridge=lambda *a, **k: {"statuses": []},
        get_fornecedores=lambda *a, **k: {"ranking": []},
        get_segmento_series=lambda *a, **k: {"pontos": []},
        get_lojas=lambda *a, **k: {"lojas": lojas},
        get_loja_detail=lambda *a, **k: loja_detail,
        get_series=lambda *a, **k: {"pontos": []},
        get_curvas_abc=lambda *a, **k: {"disponivel": False, "pontos": {"A": [], "B": [], "C": [], "D": []}},
    ), patch("app.services.raw_data.get_planilha_grafico_cd", return_value=[]), patch(
        "app.services.raw_data.get_dde_segmento", return_value=[]
    ), patch("app.services.raw_data.get_dde_geral_range", return_value=[]), patch(
        "app.services.raw_data.get_dde_segmento_range", return_value=[]
    ), patch("app.services.raw_data.get_dde_fornecedor", return_value=[]):
        result = get_comite(DATA_REF)

    assert result["loja_critica"]["cod_unidade"] == "2"
