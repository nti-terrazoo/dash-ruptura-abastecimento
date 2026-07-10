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


def _get_cache() -> TTLCache:
    global _cache
    if _cache is None:
        settings = get_settings()
        _cache = TTLCache(maxsize=2048, ttl=settings.cache_ttl_seconds)
    return _cache


def cached(key: tuple, loader: Callable[[], T]) -> T:
    """Retorna o valor em cache para `key`, ou chama `loader()` e guarda."""
    cache = _get_cache()
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
