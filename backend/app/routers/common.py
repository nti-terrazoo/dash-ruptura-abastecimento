import datetime

from fastapi import HTTPException, Query

from app.services import raw_data

VALID_DAYS_WINDOWS = (15, 30, 60)

# Janela da aba Ruptura Segmentos: 0 = "mes atual" (padrao, RS_DAYS=0 no HTML
# legado), 30 ou 60 dias corridos.
SEGMENTO_DAYS_WINDOWS = (0, 30, 60)


def get_days_window(days: int = Query(15, description="Janela em dias: 15, 30 ou 60.")) -> int:
    # Um Literal[15,30,60] direto no parametro nao e coagido de forma
    # confiavel a partir da query string nesta combinacao de FastAPI/Pydantic
    # (chega como str e falha a validacao) - validamos manualmente em vez de
    # depender dessa coercao.
    if days not in VALID_DAYS_WINDOWS:
        raise HTTPException(status_code=422, detail=f"Parametro 'days' deve ser um de {VALID_DAYS_WINDOWS}.")
    return days


def get_segmento_days_window(days: int = Query(0, description="Janela: 0 (mes atual), 30 ou 60.")) -> int:
    if days not in SEGMENTO_DAYS_WINDOWS:
        raise HTTPException(status_code=422, detail=f"Parametro 'days' deve ser um de {SEGMENTO_DAYS_WINDOWS}.")
    return days


def get_reference_date(
    date: str | None = Query(None, description="Data de referencia (YYYY-MM-DD). Default: data mais recente disponivel."),
) -> datetime.date:
    if date:
        try:
            return datetime.date.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=422, detail="Parametro 'date' invalido, use o formato YYYY-MM-DD.")

    dates = raw_data.get_available_dates()
    if not dates:
        raise HTTPException(status_code=503, detail="Nenhuma data disponivel (Oracle indisponivel ou sem dados).")
    return dates[0]
