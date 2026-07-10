import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.routers.common import get_reference_date
from app.schemas.dashboard import BridgeDrilldownResponse, BridgeResponse
from app.services import dashboard_service

router = APIRouter(tags=["bridge"])

BridgeMode = Literal["geral", "segmento", "loja"]


@router.get("/bridge", response_model=BridgeResponse)
def bridge(
    data_referencia: datetime.date = Depends(get_reference_date),
    mode: BridgeMode = Query("geral"),
    chave: str | None = Query(None, description="Nome do segmento ou cod_unidade da loja, conforme o mode."),
):
    if mode != "geral" and not chave:
        raise HTTPException(status_code=422, detail="Parametro 'chave' obrigatorio para mode != 'geral'.")
    return dashboard_service.get_bridge(data_referencia, mode=mode, chave=chave)


@router.get("/bridge/drilldown", response_model=BridgeDrilldownResponse)
def bridge_drilldown(
    status_label: str,
    data_referencia: datetime.date = Depends(get_reference_date),
    mode: BridgeMode = Query("geral"),
    chave: str | None = Query(None),
):
    return dashboard_service.get_bridge_drilldown(data_referencia, mode=mode, chave=chave, status_label=status_label)
