"""Cache em memoria por (view, chave). Os dados de uma DATA_REFERENCIA ja
carregada nao mudam (ver README - o ETL do Oracle so escreve cada dia uma
vez), entao cachear evita ir ao Oracle de novo - e o principal mecanismo de
performance do backend (o dashboard antigo recalculava tudo no browser a
cada clique).

Dois pools com TTLs diferentes:
- `cached()`: dados de uma DATA_REFERENCIA especifica - TTL longo
  (CACHE_TTL_SECONDS, default 24h), pois nao mudam depois de calculados.
- `cached_dates()`: a lista de "datas disponiveis" - TTL curto
  (DATES_CACHE_TTL_SECONDS, default 10min), para o app perceber rapido
  quando o ETL publica um novo dia (o job de warm-up em
  app/jobs/cache_warmup.py tambem forca essa atualizacao todo dia).

Endpoints rodam em threads (ver nota em main.py), entao o acesso ao cache
precisa ser thread-safe.
"""

import threading
from typing import Callable, TypeVar

from cachetools import TTLCache

from app.config import get_settings

T = TypeVar("T")

_lock = threading.Lock()
_data_cache: TTLCache | None = None
_dates_cache: TTLCache | None = None

# Um lock por chave, so para a duracao do primeiro calculo daquela chave -
# evita que duas requisicoes concorrentes para o MESMO (view, data) (ex:
# a bridge geral e o detalhe de segmento, que internamente leem a mesma
# VW_DASH_LOJAS_BRIDGE) disparem a consulta lenta duas vezes em paralelo.
# A segunda requisicao espera a primeira terminar e reaproveita o resultado
# em vez de repetir o round-trip ao Oracle.
_key_locks: dict[tuple, threading.Lock] = {}


def _get_data_cache() -> TTLCache:
    global _data_cache
    if _data_cache is None:
        settings = get_settings()
        _data_cache = TTLCache(maxsize=4096, ttl=settings.cache_ttl_seconds)
    return _data_cache


def _get_dates_cache() -> TTLCache:
    global _dates_cache
    if _dates_cache is None:
        settings = get_settings()
        _dates_cache = TTLCache(maxsize=16, ttl=settings.dates_cache_ttl_seconds)
    return _dates_cache


def _get_key_lock(key: tuple) -> threading.Lock:
    with _lock:
        key_lock = _key_locks.get(key)
        if key_lock is None:
            key_lock = threading.Lock()
            _key_locks[key] = key_lock
        return key_lock


def _cached_in(cache: TTLCache, key: tuple, loader: Callable[[], T]) -> T:
    """Concorrente-safe: se duas chamadas pedirem a mesma `key` ao mesmo
    tempo e nenhuma estiver em cache ainda, a segunda espera a primeira em
    vez de recalcular (ver _key_locks acima)."""
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


def cached(key: tuple, loader: Callable[[], T]) -> T:
    """Retorna o valor em cache (TTL longo) para `key`, ou chama `loader()`
    e guarda."""
    return _cached_in(_get_data_cache(), key, loader)


def cached_dates(key: tuple, loader: Callable[[], T]) -> T:
    """Igual a `cached()`, mas no pool de TTL curto - usado so pela lista de
    datas disponiveis."""
    return _cached_in(_get_dates_cache(), key, loader)


def clear_cache() -> None:
    with _lock:
        _get_data_cache().clear()
        _get_dates_cache().clear()
        _key_locks.clear()
