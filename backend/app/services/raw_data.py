"""Camada de acesso as 12 views Oracle, com cache por (view, data). Cada
funcao devolve list[dict] com chaves em snake_case, prontas para os services
de agregacao (dashboard_service.py) consumirem sem precisar conhecer SQL.
"""

import datetime

from app.cache import cached, cached_dates
from app.config import get_settings
from app.db import queries
from app.db.oracle import get_connection


def _rows_as_dicts(cursor) -> list[dict]:
    columns = [col[0].lower() for col in cursor.description]
    rows = []
    for raw_row in cursor:
        row = dict(zip(columns, raw_row))
        for key, value in row.items():
            if isinstance(value, datetime.datetime):
                row[key] = value.date()
        rows.append(row)
    return rows



# Default do driver e arraysize=100/prefetchrows=2 - para views com muitas
# linhas (ex. VW_DASH_LOJAS_BRIDGE, uma linha por item/loja) isso significa
# dezenas ou centenas de round-trips ao Oracle so para buscar um resultado
# que caberia em poucos. Aumentar os dois reduz drasticamente o numero de
# round-trips numa rede com latencia (o cenario deste projeto, Oracle
# legado acessado remotamente) - e o principal motivo do primeiro
# carregamento do dia ser lento.
_FETCH_ARRAYSIZE = 5000


def _run(sql_template: str, params: dict) -> list[dict]:
    schema = get_settings().oracle_schema
    sql = sql_template.format(schema=schema)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.arraysize = _FETCH_ARRAYSIZE
        cursor.prefetchrows = _FETCH_ARRAYSIZE
        cursor.execute(sql, params)
        return _rows_as_dicts(cursor)


def _fetch_for_date(view_name: str, sql_template: str, data_referencia: datetime.date) -> list[dict]:
    def loader():
        return _run(sql_template, {"data_referencia": data_referencia})

    return cached((view_name, data_referencia.isoformat()), loader)


def _fetch_for_range(
    view_name: str, sql_template: str, data_inicio: datetime.date, data_fim: datetime.date
) -> list[dict]:
    def loader():
        return _run(sql_template, {"data_inicio": data_inicio, "data_fim": data_fim})

    key = (view_name, f"{data_inicio.isoformat()}:{data_fim.isoformat()}")
    return cached(key, loader)


def get_planilha_geral(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("planilha_geral", queries.PLANILHA_GERAL, data_referencia)


def get_planilha_grafico(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("planilha_grafico", queries.PLANILHA_GRAFICO, data_referencia)


def get_planilha_grafico_cd(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("planilha_grafico_cd", queries.PLANILHA_GRAFICO_CD, data_referencia)


def get_dia_a_dia(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("dia_a_dia", queries.DIA_A_DIA, data_referencia)


def get_dia_a_dia_cd(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("dia_a_dia_cd", queries.DIA_A_DIA_CD, data_referencia)


def get_lojas(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("lojas", queries.LOJAS, data_referencia)


def get_fornecedores(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("fornecedores", queries.FORNECEDORES, data_referencia)


def get_lojas_bridge(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("lojas_bridge", queries.LOJAS_BRIDGE, data_referencia)


def get_lojas_bridge_top_critico(data_referencia: datetime.date) -> list[dict]:
    """No maximo 1 linha - ver comentario de LOJAS_BRIDGE_TOP_CRITICO."""
    return _fetch_for_date("lojas_bridge_top_critico", queries.LOJAS_BRIDGE_TOP_CRITICO, data_referencia)


def get_dde_geral(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("dde_geral", queries.DDE_GERAL, data_referencia)


def get_dde_fornecedor(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("dde_fornecedor", queries.DDE_FORNECEDOR, data_referencia)


def get_dde_lojas(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("dde_lojas", queries.DDE_LOJAS, data_referencia)


def get_dde_segmento(data_referencia: datetime.date) -> list[dict]:
    return _fetch_for_date("dde_segmento", queries.DDE_SEGMENTO, data_referencia)


def get_available_dates(limit: int = 15) -> list[datetime.date]:
    def loader():
        rows = _run(queries.AVAILABLE_DATES, {"limit": limit})
        return [row["data_referencia"] for row in rows]

    return cached_dates(("available_dates", str(limit)), loader)


def get_dia_a_dia_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range("dia_a_dia_range", queries.DIA_A_DIA_RANGE, data_inicio, data_fim)


def get_dia_a_dia_cd_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range("dia_a_dia_cd_range", queries.DIA_A_DIA_CD_RANGE, data_inicio, data_fim)


def get_planilha_grafico_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range("planilha_grafico_range", queries.PLANILHA_GRAFICO_RANGE, data_inicio, data_fim)


def get_planilha_grafico_cd_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range("planilha_grafico_cd_range", queries.PLANILHA_GRAFICO_CD_RANGE, data_inicio, data_fim)


def get_fornecedores_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range("fornecedores_range", queries.FORNECEDORES_RANGE, data_inicio, data_fim)


def get_dde_segmento_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range("dde_segmento_range", queries.DDE_SEGMENTO_RANGE, data_inicio, data_fim)


def get_dde_geral_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range("dde_geral_range", queries.DDE_GERAL_RANGE, data_inicio, data_fim)


def get_curvas_abc_agregado_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range(
        "curvas_abc_agregado_range", queries.CURVAS_ABC_AGREGADO_RANGE, data_inicio, data_fim
    )


def get_arq02_curva_range(data_inicio: datetime.date, data_fim: datetime.date) -> list[dict]:
    return _fetch_for_range("arq02_curva_range", queries.ARQ_02_CURVA_RANGE, data_inicio, data_fim)
