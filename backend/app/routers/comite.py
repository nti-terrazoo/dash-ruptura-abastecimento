import datetime

from fastapi import APIRouter, Depends

from app.routers.common import get_reference_date
from app.schemas.dashboard import ComiteResponse
from app.services import dashboard_service

router = APIRouter(tags=["comite"])


@router.get("/comite", response_model=ComiteResponse)
def comite(data_referencia: datetime.date = Depends(get_reference_date)):
    """Dados da Apresentacao Comite - sem gate de senha (diferente do
    Briefing 9h). A data usada e sempre a mesma data de referencia
    selecionada na sidebar."""
    return dashboard_service.get_comite(data_referencia)
