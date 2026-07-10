import datetime

from fastapi import APIRouter, Depends, Query

from app.routers.common import get_days_window, get_reference_date
from app.schemas.dashboard import SegmentoDetailResponse, SegmentoSeriesResponse
from app.services import dashboard_service

router = APIRouter(tags=["segmentos"])


@router.get("/segmentos/{segmento}", response_model=SegmentoDetailResponse)
def segmento_detail(segmento: str, data_referencia: datetime.date = Depends(get_reference_date)):
    return dashboard_service.get_segmento_detail(data_referencia, segmento)


@router.get("/segmentos/{segmento}/series", response_model=SegmentoSeriesResponse)
def segmento_series(
    segmento: str,
    data_referencia: datetime.date = Depends(get_reference_date),
    days: int = Depends(get_days_window),
    cd: bool = Query(False),
):
    return dashboard_service.get_segmento_series(segmento, data_referencia, dias=days, com_cd=cd)
