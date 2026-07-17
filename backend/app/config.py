from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    oracle_user: str = ""
    oracle_password: str = ""
    oracle_dsn: str = ""
    oracle_client_lib_dir: str = ""
    oracle_pool_min: int = 2
    oracle_pool_max: int = 10
    oracle_pool_increment: int = 1
    oracle_schema: str = "EPORTAL"

    # Os dados de uma DATA_REFERENCIA especifica nao mudam depois de calculados
    # pelo ETL do Oracle (ver README) - 24h e seguro e evita reconsultar o
    # Oracle (a bridge geral sozinha pode levar dezenas de segundos) varias
    # vezes ao longo do mesmo dia.
    cache_ttl_seconds: int = 86400
    # A lista de "datas disponiveis" e a excecao: precisa de um TTL curto
    # para o app perceber rapido quando o ETL publica um novo dia (o
    # warm-up as 1h tambem forca essa atualizacao, mas isso cobre o caso de
    # o ETL atrasar ou o warm-up falhar).
    dates_cache_ttl_seconds: int = 600

    # Horario do job diario que aquece o cache do dia mais recente (ver
    # app/jobs/cache_warmup.py) - default logo apos o ETL noturno do Oracle.
    cache_warmup_hour: int = 8
    cache_warmup_minute: int = 0

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
