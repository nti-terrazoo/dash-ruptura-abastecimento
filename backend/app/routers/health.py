from fastapi import APIRouter

from app.db.oracle import check_connection, is_pool_up
from app.schemas.dashboard import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health():
    connected = is_pool_up() and check_connection()
    return HealthResponse(status="ok" if connected else "degraded", oracle_connected=connected)
