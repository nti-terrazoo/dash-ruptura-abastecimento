import logging
from contextlib import contextmanager

import oracledb

from app.config import get_settings

logger = logging.getLogger("app.db.oracle")

_pool: oracledb.ConnectionPool | None = None
_thick_mode_initialized = False


class OracleUnavailableError(RuntimeError):
    """Levantado quando o pool Oracle nao esta disponivel (ex: .env ainda nao
    configurado, ou o banco esta fora do ar). Tratado em main.py como 503,
    para os endpoints nao vazarem um 500 cru quando o Oracle esta offline."""


def _init_thick_mode_if_configured() -> None:
    """Initializes python-oracledb "thick" mode using a local Oracle Instant
    Client. Required for Oracle 11g or older, which the pure-Python "thin"
    mode does not support. Must run once per process, before any connection
    is opened. If ORACLE_CLIENT_LIB_DIR is empty, thin mode is used instead
    (valid for Oracle 12.1+).
    """
    global _thick_mode_initialized
    if _thick_mode_initialized:
        return
    settings = get_settings()
    if settings.oracle_client_lib_dir:
        oracledb.init_oracle_client(lib_dir=settings.oracle_client_lib_dir)
        logger.info("python-oracledb inicializado em modo thick (lib_dir=%s)", settings.oracle_client_lib_dir)
    else:
        logger.info("ORACLE_CLIENT_LIB_DIR nao definido - usando modo thin (requer Oracle 12.1+)")
    _thick_mode_initialized = True


def init_pool() -> None:
    """Creates the connection pool once, at application startup. Failures are
    logged but do not crash the app - /api/health reports the pool as down
    and every other endpoint will surface a 503 until it is reachable, so the
    API stays usable (e.g. for /docs) even before .env is filled in.
    """
    global _pool
    settings = get_settings()
    try:
        _init_thick_mode_if_configured()
        _pool = oracledb.create_pool(
            user=settings.oracle_user,
            password=settings.oracle_password,
            dsn=settings.oracle_dsn,
            min=settings.oracle_pool_min,
            max=settings.oracle_pool_max,
            increment=settings.oracle_pool_increment,
        )
        logger.info("Pool Oracle criado (min=%s max=%s)", settings.oracle_pool_min, settings.oracle_pool_max)
    except Exception:
        logger.exception("Falha ao criar o pool Oracle - verifique ORACLE_* no .env")
        _pool = None


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close(force=True)
        _pool = None


def is_pool_up() -> bool:
    return _pool is not None


@contextmanager
def get_connection():
    if _pool is None:
        raise OracleUnavailableError(
            "Pool Oracle indisponivel. Confira as credenciais em .env e se o Oracle Instant Client "
            "esta configurado (ORACLE_CLIENT_LIB_DIR) quando necessario."
        )
    try:
        connection = _pool.acquire()
    except oracledb.Error as exc:
        raise OracleUnavailableError(f"Nao foi possivel conectar ao Oracle: {exc}") from exc
    try:
        yield connection
    finally:
        _pool.release(connection)


def check_connection() -> bool:
    """Used by /api/health. Acquires a connection and runs a trivial query."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM DUAL")
            cursor.fetchone()
        return True
    except Exception:
        logger.exception("Health check Oracle falhou")
        return False
