"""Aquece o cache uma vez por dia (por padrao as 01:00, ver
CACHE_WARMUP_HOUR/MINUTE em app/config.py), logo apos o horario tipico do
ETL noturno do Oracle publicar o novo dia. Sem isso, a primeira pessoa a
abrir o dashboard de manha pagaria o custo da bridge geral sozinha (pode
levar dezenas de segundos com cache frio - ver dashboard_service.get_bridge
e o comentario em LOJAS_BRIDGE_TOP_CRITICO em app/db/queries.py).

Cada passo roda isolado (try/except) para uma falha pontual (ex: Oracle
fora do ar por um instante) nao abortar o resto do warm-up.
"""

import logging

from app.core.business_rules import VALID_SEGMENTOS
from app.services import dashboard_service, raw_data

logger = logging.getLogger("app.jobs.cache_warmup")

SERIES_DAYS_WINDOWS = (15, 30, 60)


def _run_step(description: str, fn, *args, **kwargs) -> None:
    try:
        fn(*args, **kwargs)
    except Exception:
        logger.exception("Warm-up: falha no passo '%s'", description)


def warm_cache() -> None:
    """Descobre a data de referencia mais recente e pre-carrega os dados
    usados pela visao padrao de cada aba do dashboard. Reaproveita os
    proprios services (dashboard_service/raw_data) - mesmo cache, mesma
    chave, que os endpoints HTTP usam."""
    dates = raw_data.get_available_dates()
    if not dates:
        logger.warning("Warm-up de cache abortado: nenhuma data disponivel no Oracle")
        return

    data_referencia = dates[0]
    logger.info("Iniciando warm-up de cache para %s", data_referencia)

    _run_step("overview", dashboard_service.get_overview, data_referencia)
    _run_step("overview item critico", dashboard_service.get_overview_item_critico, data_referencia)
    for dias in SERIES_DAYS_WINDOWS:
        _run_step(f"overview series {dias}d s/CD", dashboard_service.get_series, data_referencia, dias=dias, com_cd=False)
        _run_step(f"overview series {dias}d c/CD", dashboard_service.get_series, data_referencia, dias=dias, com_cd=True)

    _run_step("lojas", dashboard_service.get_lojas, data_referencia)
    _run_step("fornecedores", dashboard_service.get_fornecedores, data_referencia, segmento="TODOS")

    # A bridge geral e a consulta mais pesada do dashboard (varre a
    # VW_DASH_LOJAS_BRIDGE inteira) - uma vez cacheada aqui, o detalhe de
    # cada segmento abaixo reaproveita o mesmo resultado (mesma chave de
    # cache em raw_data.get_lojas_bridge) em vez de repetir a varredura.
    _run_step("bridge geral", dashboard_service.get_bridge, data_referencia, mode="geral")

    for segmento in VALID_SEGMENTOS:
        _run_step(f"segmento detail {segmento}", dashboard_service.get_segmento_detail, data_referencia, segmento)
        _run_step(
            f"segmento series {segmento}",
            dashboard_service.get_segmento_series,
            segmento,
            data_referencia,
            dias=0,
            com_cd=False,
        )

    logger.info("Warm-up de cache concluido para %s", data_referencia)
