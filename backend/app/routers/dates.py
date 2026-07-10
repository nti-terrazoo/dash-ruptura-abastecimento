from fastapi import APIRouter

from app.schemas.dashboard import DatesResponse
from app.services import raw_data

router = APIRouter(tags=["dates"])


@router.get("/dates", response_model=DatesResponse)
def list_dates():
    dates = raw_data.get_available_dates()
    return DatesResponse(dates=dates, default=dates[0] if dates else None)
