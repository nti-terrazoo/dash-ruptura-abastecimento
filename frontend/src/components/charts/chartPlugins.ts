import type { Plugin } from "chart.js";
import { formatCurrency, formatDde, formatPercent } from "../../lib/format";

/** Opcoes de tooltip/legenda compartilhadas - portadas do objeto `BO` do
 * dashboard legado (linhas ~1780 do HTML original). */
export const tooltipBaseStyle = {
  backgroundColor: "rgba(240,244,240,.97)",
  borderColor: "#c5d9c5",
  borderWidth: 1,
  titleColor: "#1a2e22",
  bodyColor: "rgba(26,46,34,.7)",
  padding: 10,
  cornerRadius: 8,
} as const;

export const gridStyle = { color: "rgba(45,107,74,.06)" } as const;
export const tickColor = "rgba(26,46,34,.45)" as const;

/**
 * Plugin `afterDatasetsDraw` que desenha rotulos de valor sobre o grafico
 * combo (barra + linha) da Visao Geral (`cSerie` no legado): valor em R$
 * rotacionado -90 dentro das barras, % acima/abaixo dos pontos de linha, DDE
 * abaixo dos pontos da linha de DDE. Identifica o tipo de rotulo pelo
 * `datasetLabelKind` que cada dataset carrega (ver SeriesChart.tsx).
 */
export const seriesValueLabelsPlugin: Plugin<"bar" | "line"> = {
  id: "seriesValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const kind = (dataset as { datasetLabelKind?: string }).datasetLabelKind;
      if (!kind) return;
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      meta.data.forEach((element, i) => {
        const raw = dataset.data[i];
        const value = typeof raw === "number" ? raw : null;
        if (value === null) return;
        const { x, y } = element as unknown as { x: number; y: number };

        ctx.save();
        if (kind === "valor-barra") {
          ctx.font = "bold 12px 'DM Mono',monospace";
          ctx.fillStyle = String(dataset.label).includes("c/ CD") ? "#ffffff" : "#3a4a3e";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.translate(x, y - 10);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(formatCurrency(value), 0, 0);
        } else if (kind === "percentual-linha") {
          ctx.font = "bold 10px Inter,sans-serif";
          ctx.fillStyle = "#3a4a3e";
          ctx.textAlign = "center";
          ctx.fillText(formatPercent(value, 1), x, y - 10);
        } else if (kind === "dde-linha") {
          ctx.font = "bold 10px 'DM Mono',monospace";
          ctx.fillStyle = "#7a8b80";
          ctx.textAlign = "center";
          ctx.fillText(formatDde(value), x, y + 14);
        }
        ctx.restore();
      });
    });
  },
};

/**
 * Plugin `afterDatasetsDraw` do waterfall da bridge (`cBridge` no legado):
 * desenha `pp%` e valor em R$ acima de cada barra visivel (dataset 1 - o
 * dataset 0 e a base invisivel do stacked bar usada so para posicionar).
 */
export const bridgeValueLabelsPlugin: Plugin<"bar"> = {
  id: "bridgeValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(1);
    const dataset = chart.data.datasets[1] as { data: number[]; extra?: { pp: number; valor: number }[] };
    if (!meta || !dataset?.extra) return;

    meta.data.forEach((element, i) => {
      const extra = dataset.extra?.[i];
      if (!extra) return;
      const { x, y } = element as unknown as { x: number; y: number };

      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#3a4a3e";
      ctx.font = "bold 11px Inter,sans-serif";
      ctx.fillText(formatPercent(extra.pp, 1), x, y - 22);
      ctx.font = "10px 'DM Mono',monospace";
      ctx.fillStyle = "rgba(26,46,34,.6)";
      ctx.fillText(formatCurrency(extra.valor), x, y - 9);
      ctx.restore();
    });
  },
};
