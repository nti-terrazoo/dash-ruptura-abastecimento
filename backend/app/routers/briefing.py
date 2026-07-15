import datetime

from fastapi import APIRouter, Depends

from app.routers.common import get_reference_date
from app.schemas.dashboard import BriefingResponse
from app.services import dashboard_service

router = APIRouter(tags=["briefing"])


@router.get("/briefing", response_model=BriefingResponse)
def briefing(data_referencia: datetime.date = Depends(get_reference_date)):
    """Dados do "Briefing 9h" - o gate de senha e so no frontend (ver
    Sidebar/BriefingModal), este endpoint em si nao exige autenticacao,
    igual ao resto da API nesta fase (ver README, secao de auth)."""
    return dashboard_service.get_briefing(data_referencia)
