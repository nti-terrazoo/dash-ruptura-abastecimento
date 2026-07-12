"""Modelos de resposta da API. Numeros sao sempre crus (float/int) e datas
sempre ISO 8601 - formatacao de exibicao (R$ 1,2M, %, "Xd") fica a cargo do
frontend."""

import datetime

from pydantic import BaseModel


class DatesResponse(BaseModel):
    dates: list[datetime.date]
    default: datetime.date | None


class HealthResponse(BaseModel):
    status: str
    oracle_connected: bool


class KpiRuptura(BaseModel):
    percentual: float
    valor: float


class TopFornecedorDde(BaseModel):
    fornecedor: str
    dde: float


class TopSegmentoPercentual(BaseModel):
    segmento: str
    percentual: float


class SegmentoRuptura(BaseModel):
    segmento: str
    valor: float
    percentual: float
    meta: float | None
    acima_meta: bool
    cor: str


class ItemBridge(BaseModel):
    cod_produto: str | None = None
    produto: str | None = None
    cod_unidade: str | None = None
    loja: str | None = None
    segmento: str | None = None
    fornecedor: str | None = None
    valor: float
    situacao: str | None = None
    status_label: str | None = None


class OverviewResponse(BaseModel):
    data_referencia: datetime.date
    meta_percentual: float
    ruptura_sem_cd: KpiRuptura
    ruptura_com_cd: KpiRuptura
    dde_geral: float | None
    top_fornecedores_dde: list[TopFornecedorDde]
    top_segmentos: list[TopSegmentoPercentual]
    ruptura_por_segmento: list[SegmentoRuptura]
    item_critico: ItemBridge | None


class SeriePoint(BaseModel):
    data: datetime.date
    valor: float
    percentual: float


class SeriesResponse(BaseModel):
    dias: int
    com_cd: bool
    pontos: list[SeriePoint]


class LojaRow(BaseModel):
    cod_unidade: str
    nome: str
    valor: float
    percentual: float
    dde: float | None
    status: str
    cor: str


class LojasResponse(BaseModel):
    data_referencia: datetime.date
    lojas: list[LojaRow]
    dentro_meta: list[LojaRow]
    acima_meta: list[LojaRow]


class SegmentoOfensor(BaseModel):
    segmento: str
    valor: float


class LojaDetailResponse(BaseModel):
    data_referencia: datetime.date
    cod_unidade: str
    nome: str
    percentual: float
    valor: float
    dde: float | None
    status: str
    segmentos_ofensores: list[SegmentoOfensor]
    top_itens: list[ItemBridge]


class FornecedorRow(BaseModel):
    fornecedor: str
    valor: float
    percentual: float
    dde: float | None
    cor: str


class FornecedoresResponse(BaseModel):
    data_referencia: datetime.date
    segmento: str
    destaques: list[FornecedorRow]
    ranking: list[FornecedorRow]


class BridgeStatusItem(BaseModel):
    label: str
    color: str
    valor: float
    pp: float


class BridgeResponse(BaseModel):
    data_referencia: datetime.date
    mode: str
    chave: str | None
    meta_percentual: float | None
    percentual_atual: float
    valor_atual: float
    statuses: list[BridgeStatusItem]


class BridgeDrilldownResponse(BaseModel):
    data_referencia: datetime.date
    mode: str
    chave: str | None
    status_label: str
    itens: list[ItemBridge]


class FornecedorHistoricoDia(BaseModel):
    data: datetime.date
    valor: float
    percentual: float


class FornecedorHistorico(BaseModel):
    fornecedor: str
    dde: float | None
    dias: list[FornecedorHistoricoDia]


class CriticoEstimado(BaseModel):
    pp: float
    valor: float


class SegmentoSeriePoint(BaseModel):
    data: datetime.date
    valor: float
    percentual: float
    dde: float | None


class SegmentoSeriesResponse(BaseModel):
    dias: int
    com_cd: bool
    pontos: list[SegmentoSeriePoint]


class SegmentoDetailResponse(BaseModel):
    data_referencia: datetime.date
    segmento: str
    percentual: float
    valor: float
    meta_percentual: float | None
    acima_meta: bool
    dde: float | None
    dde_meta: float | None
    cor: str
    bridge: list[BridgeStatusItem]
    critico_estimado: CriticoEstimado
    item_critico: ItemBridge | None
    top_fornecedores_ultimos_dias: list[FornecedorHistorico]
