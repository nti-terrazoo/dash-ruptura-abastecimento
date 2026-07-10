import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.routers.common import get_reference_date
from app.schemas.dashboard import LojaDetailResponse, LojasResponse
from app.services import dashboard_service

router = APIRouter(tags=["lojas"])


@router.get("/lojas", response_model=LojasResponse)
def lojas(data_referencia: datetime.date = Depends(get_reference_date)):
    return dashboard_service.get_lojas(data_referencia)


@router.get("/lojas/{cod_unidade}", response_model=LojaDetailResponse)
def loja_detail(cod_unidade: str, data_referencia: datetime.date = Depends(get_reference_date)):
    detail = dashboard_service.get_loja_detail(data_referencia, cod_unidade)
    if detail is None:
        raise HTTPException(status_code=404, detail="Loja nao encontrada para a data informada.")
    return detail
