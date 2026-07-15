import type { BriefingPauta, BriefingResponse } from "../../api/types";
import { formatCurrency, formatPercent } from "../../lib/format";

/** Monta o parágrafo-resumo a partir dos campos crus do briefing - o backend
 * so classifica (tendência, contagens); a formatação de exibição fica aqui,
 * junto com o resto das regras de formatação do app. */
export function buildResumo(data: BriefingResponse): string {
  const tendenciaTxt = data.tendencia === "alta" ? "em alta" : data.tendencia === "queda" ? "em queda" : "estável";
  const segmentosTxt =
    data.segmentos_acima_meta === 0
      ? "todos os segmentos dentro da meta"
      : data.segmentos_acima_meta === 1
        ? "1 segmento fora da meta"
        : `${data.segmentos_acima_meta} segmentos fora da meta`;

  let texto =
    `Ruptura geral em ${formatPercent(data.ruptura_percentual)}, ${tendenciaTxt} em relação a ontem ` +
    `(${formatPercent(data.ruptura_percentual_anterior)}). ${segmentosTxt}.`;

  if (data.sem_pedido_valor > 0) {
    texto += ` ${formatCurrency(data.sem_pedido_valor)} em situação crítica ainda sem pedido gerado — ação urgente necessária.`;
  }

  return texto;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Um template de frase por tipo de pauta - o backend so decide QUAIS pautas
 * existem e com quais números (regras de negócio); o texto final é montado
 * aqui, igual ao resumo acima. */
export function buildPautaTexto(pauta: BriefingPauta): string {
  switch (pauta.tipo) {
    case "sem_pedido":
      return `${formatCurrency(pauta.valor ?? 0)} em Sit. Crítica s/ Pedido — cobrar buyer: qual o plano de ação para hoje?`;
    case "loja_critica":
      return `${pauta.nome} com ${formatPercent(pauta.percentual ?? 0, 1)} de ruptura — investigar causa: abastecimento ou mix de produtos?`;
    case "segmento_meta":
      return `Segmento ${pauta.nome} acima da meta (${formatPercent(pauta.percentual ?? 0, 2)} vs meta ${pauta.meta}%) — avaliar ponto de pedido.`;
    case "fornecedor":
      return `${truncate(pauta.nome ?? "", 35)} é o maior fornecedor em ruptura (${formatCurrency(pauta.valor ?? 0)}) — negociar prazo ou antecipar pedido.`;
    case "cd_atende":
      return `${formatCurrency(pauta.valor ?? 0)} têm CD atendendo — priorizar transferências para lojas críticas hoje.`;
    default:
      return "";
  }
}
