import datetime
from unittest.mock import patch

from app.jobs.cache_warmup import warm_cache


def test_warm_cache_does_nothing_when_no_dates_available():
    with patch("app.jobs.cache_warmup.raw_data.get_available_dates", return_value=[]):
        with patch("app.jobs.cache_warmup.dashboard_service.get_overview") as mocked_overview:
            warm_cache()
            mocked_overview.assert_not_called()


def test_warm_cache_calls_every_view_for_the_latest_date():
    latest = datetime.date(2026, 7, 7)
    with patch("app.jobs.cache_warmup.raw_data.get_available_dates", return_value=[latest]), patch(
        "app.jobs.cache_warmup.dashboard_service"
    ) as mocked_service:
        warm_cache()

    mocked_service.get_overview.assert_called_once_with(latest)
    mocked_service.get_overview_item_critico.assert_called_once_with(latest)
    mocked_service.get_lojas.assert_called_once_with(latest)
    mocked_service.get_fornecedores.assert_called_once_with(latest, segmento="TODOS")
    mocked_service.get_bridge.assert_called_once_with(latest, mode="geral")

    series_calls = mocked_service.get_series.call_args_list
    assert {(c.kwargs["dias"], c.kwargs["com_cd"]) for c in series_calls} == {
        (15, False),
        (15, True),
        (30, False),
        (30, True),
        (60, False),
        (60, True),
    }

    # Um detalhe por segmento (9 segmentos hoje) e uma serie por segmento
    # para cada combinacao de janela (Mes/30/60) x CD (s/c) - 9 * 3 * 2 = 54.
    assert mocked_service.get_segmento_detail.call_count == 9

    segmento_series_calls = mocked_service.get_segmento_series.call_args_list
    assert len(segmento_series_calls) == 54
    windows_seen = {(c.kwargs["dias"], c.kwargs["com_cd"]) for c in segmento_series_calls}
    assert windows_seen == {
        (0, False),
        (0, True),
        (30, False),
        (30, True),
        (60, False),
        (60, True),
    }


def test_warm_cache_continues_after_a_step_fails():
    latest = datetime.date(2026, 7, 7)
    with patch("app.jobs.cache_warmup.raw_data.get_available_dates", return_value=[latest]), patch(
        "app.jobs.cache_warmup.dashboard_service"
    ) as mocked_service:
        mocked_service.get_overview.side_effect = RuntimeError("Oracle indisponivel")
        warm_cache()

    # Mesmo com get_overview falhando, os passos seguintes ainda rodam.
    mocked_service.get_lojas.assert_called_once_with(latest)
    mocked_service.get_bridge.assert_called_once_with(latest, mode="geral")
