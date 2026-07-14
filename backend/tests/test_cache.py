import threading
import time

from app.cache import cached, clear_cache


def test_cached_dedupes_concurrent_calls_for_same_key():
    """Duas requisicoes concorrentes para a mesma chave (ex: bridge geral e
    detalhe de segmento, que internamente leem a mesma VW_DASH_LOJAS_BRIDGE)
    devem disparar o loader lento uma unica vez - a segunda espera a
    primeira em vez de repetir o round-trip ao Oracle."""
    clear_cache()
    call_count = 0
    count_lock = threading.Lock()

    def slow_loader():
        nonlocal call_count
        with count_lock:
            call_count += 1
        time.sleep(0.2)
        return "value"

    results: list[str] = []
    results_lock = threading.Lock()

    def worker():
        value = cached(("test-view", "2026-07-07"), slow_loader)
        with results_lock:
            results.append(value)

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert call_count == 1
    assert results == ["value"] * 5


def test_cached_different_keys_do_not_share_result():
    clear_cache()
    assert cached(("view-a", "2026-07-07"), lambda: "a") == "a"
    assert cached(("view-b", "2026-07-07"), lambda: "b") == "b"


def test_cached_reuses_value_within_ttl():
    clear_cache()
    calls = 0

    def loader():
        nonlocal calls
        calls += 1
        return calls

    first = cached(("view-c", "2026-07-07"), loader)
    second = cached(("view-c", "2026-07-07"), loader)

    assert first == 1
    assert second == 1
