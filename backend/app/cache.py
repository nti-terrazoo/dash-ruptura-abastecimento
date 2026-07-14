"""Cache em memoria por (view, chave). Os dados de uma DATA_REFERENCIA ja
carregada nao mudam, entao cachear evita ir ao Oracle a cada troca de filtro
no frontend - e o principal mecanismo de performance do backend (o dashboard
antigo recalculava tudo no browser a cada clique).

Endpoints rodam em threads (ver nota em main.py), entao o acesso ao cache
precisa ser thread-safe.
"""

import threading
from typing import Callable, TypeVar

from cachetools import TTLCache

from app.config import get_settings

T = TypeVar("T")

_lock = threading.Lock()
_cache: TTLCache | None = None

# Um lock por chave, so para a duracao do primeiro calculo daquela chave -
# evita que duas requisicoes concorrentes para o MESMO (view, data) (ex:
# a bridge geral e o detalhe de segmento, que internamente le a mesma
# VW_DASH_LOJAS_BRIDGE) disparem a consulta lenta duas vezes em paralelo.
# A segunda requisicao espera a primeira terminar e reaproveita o resultado
# em vez de repetir o round-trip ao Oracle.
_key_locks: dict[tuple, threading.Lock] = {}


def _get_cache() -> TTLCache:
    global _cache
    if _cache is None:
        settings = get_settings()
        _cache = TTLCache(maxsize=2048, ttl=settings.cache_ttl_seconds)
    return _cache


def _get_key_lock(key: tuple) -> threading.Lock:
    with _lock:
        key_lock = _key_locks.get(key)
        if key_lock is None:
            key_lock = threading.Lock()
            _key_locks[key] = key_lock
        return key_lock


def cached(key: tuple, loader: Callable[[], T]) -> T:
    """Retorna o valor em cache para `key`, ou chama `loader()` e guarda.
    Concorrente-safe: se duas chamadas pedirem a mesma `key` ao mesmo tempo
    e nenhuma estiver em cache ainda, a segunda espera a primeira em vez de
    recalcular (ver _key_locks acima)."""
    cache = _get_cache()
    with _lock:
        if key in cache:
            return cache[key]

    with _get_key_lock(key):
        with _lock:
            if key in cache:
                return cache[key]
        value = loader()
        with _lock:
            cache[key] = value
        return value


def clear_cache() -> None:
    with _lock:
        _get_cache().clear()
        _key_locks.clear()
