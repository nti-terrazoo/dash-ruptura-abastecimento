/**
 * Espelha 1:1 os schemas Pydantic em backend/app/schemas/dashboard.py.
 * Datas chegam como string ISO 8601 (YYYY-MM-DD) via JSON, nao como Date.
 */

export type IsoDate = string;

export interface DatesResponse {
  dates: IsoDate[];
  default: IsoDate | null;
}

export interface HealthResponse {
  status: string;
  oracle_connected: boolean;
}

export interface KpiRuptura {
  percentual: number;
  valor: number;
}

export interface TopFornecedorDde {
  fornecedor: string;
  dde: number;
}

export interface TopSegmentoPercentual {
  segmento: string;
  percentual: number;
}

export interface SegmentoRuptura {
  segmento: string;
  valor: number;
  percentual: number;
  meta: number | null;
  acima_meta: boolean;
  cor: string;
}

export interface ItemBridge {
  cod_produto: string | null;
  produto: string | null;
  cod_unidade: string | null;
  loja: string | null;
  segmento: string | null;
  fornecedor: string | null;
  valor: number;
  situacao: string | null;
  status_label: string | null;
}

export interface OverviewResponse {
  data_referencia: IsoDate;
  meta_percentual: number;
  ruptura_sem_cd: KpiRuptura;
  ruptura_com_cd: KpiRuptura;
  dde_geral: number | null;
  top_fornecedores_dde: TopFornecedorDde[];
  top_segmentos: TopSegmentoPercentual[];
  ruptura_por_segmento: SegmentoRuptura[];
}

export interface OverviewItemCriticoResponse {
  data_referencia: IsoDate;
  item_critico: ItemBridge | null;
}

export interface SeriePoint {
  data: IsoDate;
  valor: number;
  percentual: number;
}

export interface SeriesResponse {
  dias: number;
  com_cd: boolean;
  pontos: SeriePoint[];
}

export interface LojaRow {
  cod_unidade: string;
  nome: string;
  valor: number;
  percentual: number;
  dde: number | null;
  status: string;
  cor: string;
}

export interface LojasResponse {
  data_referencia: IsoDate;
  lojas: LojaRow[];
  dentro_meta: LojaRow[];
  acima_meta: LojaRow[];
}

export interface SegmentoOfensor {
  segmento: string;
  valor: number;
}

export interface LojaDetailResponse {
  data_referencia: IsoDate;
  cod_unidade: string;
  nome: string;
  percentual: number;
  valor: number;
  dde: number | null;
  status: string;
  segmentos_ofensores: SegmentoOfensor[];
  top_itens: ItemBridge[];
}

export interface FornecedorRow {
  fornecedor: string;
  valor: number;
  percentual: number;
  dde: number | null;
  cor: string;
}

export interface FornecedoresResponse {
  data_referencia: IsoDate;
  segmento: string;
  destaques: FornecedorRow[];
  ranking: FornecedorRow[];
}

export interface BridgeStatusItem {
  label: string;
  color: string;
  valor: number;
  pp: number;
}

export type BridgeMode = "geral" | "segmento" | "loja";

export interface BridgeResponse {
  data_referencia: IsoDate;
  mode: BridgeMode;
  chave: string | null;
  meta_percentual: number | null;
  percentual_atual: number;
  valor_atual: number;
  statuses: BridgeStatusItem[];
}

export interface BridgeDrilldownResponse {
  data_referencia: IsoDate;
  mode: BridgeMode;
  chave: string | null;
  status_label: string;
  itens: ItemBridge[];
}

export interface FornecedorHistoricoDia {
  data: IsoDate;
  valor: number;
  percentual: number;
}

export interface FornecedorHistorico {
  fornecedor: string;
  dde: number | null;
  dias: FornecedorHistoricoDia[];
}

export interface CriticoEstimado {
  pp: number;
  valor: number;
}

export interface SegmentoSeriePoint {
  data: IsoDate;
  valor: number;
  percentual: number;
  dde: number | null;
}

export interface SegmentoSeriesResponse {
  dias: number;
  com_cd: boolean;
  pontos: SegmentoSeriePoint[];
}

export interface SegmentoDetailResponse {
  data_referencia: IsoDate;
  segmento: string;
  percentual: number;
  valor: number;
  meta_percentual: number | null;
  acima_meta: boolean;
  dde: number | null;
  dde_meta: number | null;
  cor: string;
  bridge: BridgeStatusItem[];
  critico_estimado: CriticoEstimado;
  item_critico: ItemBridge | null;
  top_fornecedores_ultimos_dias: FornecedorHistorico[];
}

export interface BriefingLoja {
  nome: string;
  cod_unidade: string;
  percentual: number;
  valor: number;
}

export interface BriefingItemSemPedido {
  produto: string | null;
  loja: string | null;
  valor: number;
}

export type BriefingPautaTipo = "sem_pedido" | "loja_critica" | "segmento_meta" | "fornecedor" | "cd_atende";

export interface BriefingPauta {
  tipo: BriefingPautaTipo;
  cor: string;
  valor: number | null;
  percentual: number | null;
  meta: number | null;
  nome: string | null;
}

export type BriefingTendencia = "alta" | "queda" | "estavel";

export interface BriefingResponse {
  data_referencia: IsoDate;
  ruptura_percentual: number;
  ruptura_valor: number;
  ruptura_percentual_anterior: number;
  tendencia: BriefingTendencia;
  meta_percentual: number;
  acima_meta_geral: boolean;
  sem_pedido_valor: number;
  cd_atende_valor: number;
  dde_geral: number | null;
  segmento_critico: string | null;
  segmento_critico_percentual: number | null;
  segmento_critico_meta: number | null;
  segmentos_acima_meta: number;
  lojas_criticas: BriefingLoja[];
  melhor_loja: BriefingLoja | null;
  itens_sem_pedido: BriefingItemSemPedido[];
  pautas: BriefingPauta[];
}
