from fastapi import APIRouter

from app.jobs.cache_warmup import warm_cache

router = APIRouter(tags=["admin"])


@router.post("/admin/warm-cache")
def trigger_warm_cache():
    """Dispara manualmente o mesmo warm-up que roda todo dia as
    CACHE_WARMUP_HOUR:CACHE_WARMUP_MINUTE - util para testar ou para
    "esquentar" o cache logo depois de um deploy, sem esperar o proximo
    horario agendado. Roda de forma sincrona (pode levar dezenas de
    segundos, ver cache_warmup.py), entao a resposta so volta quando
    termina."""
    warm_cache()
    return {"status": "ok"}
