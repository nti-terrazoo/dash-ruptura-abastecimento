import datetime

from fastapi import APIRouter, Depends

from app.routers.common import get_reference_date
from app.schemas.dashboard import MetasDdeResponse
from app.services import dashboard_service

router = APIRouter(tags=["metas"])


@router.get("/metas/dde", response_model=MetasDdeResponse)
def metas_dde(data_referencia: datetime.date = Depends(get_reference_date)):
    return dashboard_service.get_metas_dde(data_referencia)
