import logging
from contextlib import asynccontextmanager

import oracledb
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db.oracle import OracleUnavailableError, close_pool, init_pool
from app.jobs.cache_warmup import warm_cache
from app.routers import admin, briefing, bridge, dates, fornecedores, health, lojas, overview, segmentos

logging.basicConfig(level=logging.INFO)

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    settings = get_settings()
    scheduler.add_job(
        warm_cache,
        CronTrigger(hour=settings.cache_warmup_hour, minute=settings.cache_warmup_minute),
        id="cache_warmup",
        replace_existing=True,
        # Se o servidor estiver fora do ar no horario exato (deploy, restart),
        # ainda roda o warm-up ao voltar em vez de pular o dia inteiro.
        misfire_grace_time=3600,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)
    close_pool()


app = FastAPI(
    title="Dashboard Ruptura de Abastecimento - API",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.exception_handler(OracleUnavailableError)
async def oracle_unavailable_handler(request: Request, exc: OracleUnavailableError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(oracledb.Error)
async def oracle_error_handler(request: Request, exc: oracledb.Error):
    return JSONResponse(status_code=503, content={"detail": f"Erro Oracle: {exc}"})


app.include_router(admin.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(dates.router, prefix="/api")
app.include_router(overview.router, prefix="/api")
app.include_router(lojas.router, prefix="/api")
app.include_router(fornecedores.router, prefix="/api")
app.include_router(bridge.router, prefix="/api")
app.include_router(segmentos.router, prefix="/api")
app.include_router(briefing.router, prefix="/api")
