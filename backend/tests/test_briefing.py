import datetime
from unittest.mock import patch

from app.services.dashboard_service import get_briefing

DATA_REF = datetime.date(2026, 7, 7)


def _patch_briefing_deps(
    *,
    pontos=None,
    dde_rows=None,
    seg_today=None,
    bridge_statuses=None,
    lojas=None,
    ranking=None,
    bridge_rows=None,
):
    return patch.multiple(
        "app.services.dashboard_service",
        get_series=lambda *a, **k: {"pontos": pontos if pontos is not None else []},
        get_segmentos_today=lambda *a, **k: seg_today or {},
        get_bridge=lambda *a, **k: {"statuses": bridge_statuses or []},
        get_lojas=lambda *a, **k: {"lojas": lojas or []},
        get_fornecedores=lambda *a, **k: {"ranking": ranking or []},
    ), patch("app.services.raw_data.get_dde_geral", return_value=dde_rows or []), patch(
        "app.services.raw_data.get_lojas_bridge", return_value=bridge_rows or []
    )


def test_tendencia_classification_thresholds():
    # +0.6pp -> alta ; -0.6pp -> queda ; +0.3pp -> estavel (threshold e 0.5pp)
    cases = [
        ([{"percentual": 10.0, "valor": 1.0}, {"percentual": 10.6, "valor": 1.0}], "alta"),
        ([{"percentual": 10.0, "valor": 1.0}, {"percentual": 9.4, "valor": 1.0}], "queda"),
        ([{"percentual": 10.0, "valor": 1.0}, {"percentual": 10.3, "valor": 1.0}], "estavel"),
    ]
    for pontos, esperado in cases:
        multi, dde_patch, bridge_patch = _patch_briefing_deps(pontos=pontos)
        with multi, dde_patch, bridge_patch:
            result = get_briefing(DATA_REF)
        assert result["tendencia"] == esperado, pontos


def test_pautas_omitted_when_nothing_critical():
    multi, dde_patch, bridge_patch = _patch_briefing_deps(
        pontos=[{"percentual": 5.0, "valor": 100.0}],
        seg_today={"PET FOOD": {"valor": 10.0, "percentual": 2.0}},
        bridge_statuses=[
            {"label": "Sit. Crítica s/ Pedido", "color": "#ff9999", "valor": 0.0, "pp": 0.0},
            {"label": "CD Atende Loja", "color": "#34c97a", "valor": 0.0, "pp": 0.0},
        ],
        lojas=[{"nome": "Loja A", "cod_unidade": "1", "percentual": 5.0, "valor": 50.0}],
        ranking=[],
    )
    with multi, dde_patch, bridge_patch:
        result = get_briefing(DATA_REF)

    assert result["pautas"] == []
    assert result["sem_pedido_valor"] == 0.0
    assert result["cd_atende_valor"] == 0.0
    assert result["melhor_loja"]["nome"] == "Loja A"
    assert result["lojas_criticas"] == []


def test_pautas_generated_for_each_critical_condition():
    multi, dde_patch, bridge_patch = _patch_briefing_deps(
        pontos=[{"percentual": 12.0, "valor": 50000.0}],
        seg_today={
            "PET ACESSORIOS": {"valor": 3000.0, "percentual": 45.0},
            "PET FOOD": {"valor": 1000.0, "percentual": 5.0},
        },
        bridge_statuses=[
            {"label": "Sit. Crítica s/ Pedido", "color": "#ff9999", "valor": 8000.0, "pp": 3.0},
            {"label": "CD Atende Loja", "color": "#34c97a", "valor": 4000.0, "pp": 1.5},
        ],
        lojas=[
            {"nome": "Loja Critica", "cod_unidade": "1", "percentual": 22.0, "valor": 9000.0},
            {"nome": "Loja OK", "cod_unidade": "2", "percentual": 4.0, "valor": 100.0},
        ],
        ranking=[{"fornecedor": "Fornecedor X", "valor": 7000.0, "percentual": 30.0, "dde": 10.0, "cor": "#e05555"}],
    )
    with multi, dde_patch, bridge_patch:
        result = get_briefing(DATA_REF)

    tipos = {p["tipo"] for p in result["pautas"]}
    assert tipos == {"sem_pedido", "loja_critica", "segmento_meta", "fornecedor", "cd_atende"}

    by_tipo = {p["tipo"]: p for p in result["pautas"]}
    assert by_tipo["sem_pedido"]["valor"] == 8000.0
    assert by_tipo["loja_critica"]["nome"] == "Loja Critica"
    assert by_tipo["segmento_meta"]["nome"] == "PET ACESSORIOS"
    assert by_tipo["segmento_meta"]["meta"] == 20.0  # SEG_METAS['PET ACESSORIOS']
    assert by_tipo["fornecedor"]["nome"] == "Fornecedor X"
    assert by_tipo["cd_atende"]["valor"] == 4000.0

    assert result["segmento_critico"] == "PET ACESSORIOS"
    assert result["segmentos_acima_meta"] == 1
    assert result["acima_meta_geral"] is True


def test_segmento_sem_meta_cadastrada_usa_fallback_10_por_cento():
    multi, dde_patch, bridge_patch = _patch_briefing_deps(
        pontos=[{"percentual": 3.0, "valor": 100.0}],
        seg_today={"MATERIAL NAO PRODUTIVO": {"valor": 500.0, "percentual": 11.0}},
    )
    with multi, dde_patch, bridge_patch:
        result = get_briefing(DATA_REF)

    assert result["segmento_critico_meta"] == 10.0
    assert any(p["tipo"] == "segmento_meta" for p in result["pautas"])


def test_itens_sem_pedido_filtrados_e_ordenados_por_valor():
    bridge_rows = [
        {
            "cod_unidade": "1",
            "descricao_produto": "Item A",
            "nome_fantasia_loja": "Loja A",
            "ruptura_valor_venda": 50.0,
            "situacao": "Situação Crítica - Sem Pedido",
        },
        {
            "cod_unidade": "1",
            "descricao_produto": "Item B",
            "nome_fantasia_loja": "Loja A",
            "ruptura_valor_venda": 200.0,
            "situacao": "SEM PEDIDO",
        },
        {
            "cod_unidade": "1",
            "descricao_produto": "Item C (CD atende)",
            "nome_fantasia_loja": "Loja A",
            "ruptura_valor_venda": 999.0,
            "situacao": "CD Atende Loja",
        },
        {
            # filial excluida (300) - nao deve entrar mesmo com status batendo
            "cod_unidade": "300",
            "descricao_produto": "Item D",
            "nome_fantasia_loja": "CD",
            "ruptura_valor_venda": 500.0,
            "situacao": "SEM PEDIDO",
        },
    ]
    multi, dde_patch, bridge_patch = _patch_briefing_deps(
        pontos=[{"percentual": 5.0, "valor": 100.0}],
        bridge_rows=bridge_rows,
    )
    with multi, dde_patch, bridge_patch:
        result = get_briefing(DATA_REF)

    nomes = [i["produto"] for i in result["itens_sem_pedido"]]
    assert nomes == ["Item B", "Item A"]
