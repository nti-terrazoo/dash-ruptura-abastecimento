/** Monta os dados da pre-visualizacao (grid de mini-cards) exibida antes do
 * download do PPTX real - mesma ordem de slides de comitePptx.ts, mas com um
 * resumo simplificado (nao tenta replicar pixel-a-pixel os graficos, so
 * mostrar que os dados de cada slide estao presentes e corretos). */
import type { ComiteResponse } from "../../api/types";
import { formatCurrency, formatDateFull, formatDde, formatPercent } from "../../lib/format";

export interface PreviewLinha {
  label: string;
  value: string;
  color?: string;
}

export interface PreviewSlide {
  titulo: string;
  linhas: PreviewLinha[];
}

const OK = "#2d6b4a";
const CRIT = "#e05555";
const CURVAS = ["A", "B", "C", "D"] as const;

export function buildPreviewSlides(data: ComiteResponse): PreviewSlide[] {
  const slides: PreviewSlide[] = [];
  const dataFmt = formatDateFull(data.data_referencia);
  const meta = data.meta_percentual;

  slides.push({
    titulo: "Capa",
    linhas: [
      { label: "Comitê de Abastecimento", value: dataFmt },
      { label: "Meta de Ruptura", value: formatPercent(meta, 0) },
    ],
  });

  const okGeral = data.ruptura_sem_cd.percentual <= meta;
  slides.push({
    titulo: "Resumo do Dia",
    linhas: [
      { label: "% Ruptura (s/CD)", value: formatPercent(data.ruptura_sem_cd.percentual), color: okGeral ? OK : CRIT },
      { label: "% Ruptura (c/CD)", value: formatPercent(data.ruptura_com_cd.percentual) },
      { label: "Valor em Ruptura", value: formatCurrency(data.ruptura_sem_cd.valor) },
      { label: "DDE Geral", value: formatDde(data.dde_geral) },
    ],
  });

  const ultimoPonto = data.serie_geral[data.serie_geral.length - 1];
  slides.push({
    titulo: `Evolução Diária (${data.serie_geral.length}d)`,
    linhas: ultimoPonto
      ? [{ label: `Último dia registrado`, value: formatPercent(ultimoPonto.percentual) }]
      : [{ label: "Sem dados no período", value: "—" }],
  });

  slides.push({
    titulo: "Bridge — Ruptura por Status",
    linhas: data.bridge_geral.map((s) => ({ label: s.label, value: `${formatPercent(s.pp, 2)}pp`, color: s.color })),
  });

  const top4 = [...data.segmentos]
    .map((s) => ({ ...s, delta: s.percentual - (s.meta ?? 10) }))
    .filter((s) => s.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);
  top4.forEach((s) => {
    slides.push({
      titulo: `Bridge — ${s.segmento}`,
      linhas: [
        { label: "% Ruptura", value: formatPercent(s.percentual), color: s.acima_meta ? CRIT : OK },
        { label: "Meta", value: s.meta != null ? formatPercent(s.meta, 0) : "—" },
        { label: "Valor", value: formatCurrency(s.valor) },
      ],
    });
  });

  const dentro = data.lojas.filter((l) => l.percentual <= 10).length;
  const acima = data.lojas.filter((l) => l.percentual > 10).length;
  slides.push({
    titulo: "Ranking de Lojas",
    linhas: [
      { label: "Dentro da meta", value: String(dentro), color: OK },
      { label: "Acima da meta", value: String(acima), color: CRIT },
    ],
  });

  if (data.loja_critica) {
    slides.push({
      titulo: `Loja Crítica: ${data.loja_critica.nome}`,
      linhas: [
        { label: "% Ruptura", value: formatPercent(data.loja_critica.percentual), color: CRIT },
        { label: "Valor em ruptura", value: formatCurrency(data.loja_critica.valor) },
        { label: "Itens críticos listados", value: String(data.loja_critica.top_itens.length) },
      ],
    });
  }

  slides.push({
    titulo: "Visão por Fornecedor",
    linhas: data.segmentos.slice(0, 9).map((s) => ({
      label: s.segmento,
      value: s.top_fornecedores[0]?.fornecedor ?? "—",
    })),
  });

  if (data.curvas.disponivel) {
    slides.push({
      titulo: "Curvas ABC — Resumo do Dia",
      linhas: CURVAS.map((c) => {
        const pontos = data.curvas.pontos[c];
        const ultimo = pontos[pontos.length - 1];
        return { label: `Curva ${c}`, value: ultimo ? formatPercent(ultimo.pct) : "—" };
      }),
    });
    CURVAS.forEach((c) => {
      slides.push({
        titulo: `Ruptura Específica — Curva ${c}`,
        linhas: [{ label: "Pontos no histórico", value: String(data.curvas.pontos[c].length) }],
      });
    });
    CURVAS.forEach((c) => {
      const pontos = data.curvas.pontos[c];
      const ultimo = pontos[pontos.length - 1];
      slides.push({
        titulo: `Ruptura em PP — Curva ${c}`,
        linhas: [{ label: "Último valor", value: ultimo?.pp != null ? `${ultimo.pp}pp` : "—" }],
      });
    });
  } else {
    slides.push({
      titulo: "Curvas ABC",
      linhas: [{ label: "Indisponível", value: "Sem dados de curva ABC para o período" }],
    });
  }

  data.segmentos.forEach((s) => {
    slides.push({
      titulo: `Segmento: ${s.segmento}`,
      linhas: [
        { label: "% Ruptura", value: formatPercent(s.percentual), color: s.acima_meta ? CRIT : OK },
        { label: "Valor", value: formatCurrency(s.valor) },
        { label: "Top fornecedor", value: s.top_fornecedores[0]?.fornecedor ?? "—" },
      ],
    });
  });

  return slides;
}
