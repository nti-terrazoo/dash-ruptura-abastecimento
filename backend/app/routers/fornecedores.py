import datetime

from fastapi import APIRouter, Depends, Query

from app.routers.common import get_reference_date
from app.schemas.dashboard import FornecedoresResponse
from app.services import dashboard_service

router = APIRouter(tags=["fornecedores"])


@router.get("/fornecedores", response_model=FornecedoresResponse)
def fornecedores(
    data_referencia: datetime.date = Depends(get_reference_date),
    segmento: str = Query("TODOS"),
):
    return dashboard_service.get_fornecedores(data_referencia, segmento=segmento)
