import type { ChartConfiguration, ChartDataset } from "chart.js";
import { useMemo } from "react";
import type { SegmentoSeriePoint } from "../../api/types";
import { formatCurrency, formatDateShort } from "../../lib/format";
import { seriesValueLabelsPlugin, tooltipBaseStyle } from "./chartPlugins";
import { useChart } from "./useChart";
import "./chartSetup";

type LabeledDataset = ChartDataset<"bar" | "line", (number | null)[]> & { datasetLabelKind?: string };

interface SegmentEvolutionChartProps {
  points: SegmentoSeriePoint[];
  pointsCd?: SegmentoSeriePoint[];
  showSemCd: boolean;
  showComCd: boolean;
  metaPercentual: number;
}

/** Combo barra+linha com 3 eixos (%, R$, DDE) - equivalente ao `cRsSeg` da
 * aba Ruptura Segmentos no dashboard legado ("% Ruptura · DDE · Dias de
 * Estoque"). A linha de DDE e a de Meta aparecem sempre, independente do
 * toggle s/CD · c/CD (mesmo comportamento do `selRS()` original). */
export function SegmentEvolutionChart({ points, pointsCd, showSemCd, showComCd, metaPercentual }: SegmentEvolutionChartProps) {
  const config = useMemo<ChartConfiguration<"bar" | "line">>(() => {
    const labels = points.map((p) => formatDateShort(p.data));
    const datasets: LabeledDataset[] = [];

    if (showSemCd) {
      datasets.push({
        type: "bar",
        label: "Valor s/ CD",
        data: points.map((p) => p.valor),
        backgroundColor: "#7dd4a060",
        borderColor: "#7dd4a0",
        borderWidth: 1,
        yAxisID: "yV",
        order: 4,
        datasetLabelKind: "valor-barra",
      });
      datasets.push({
        type: "line",
        label: "% s/ CD",
        data: points.map((p) => p.percentual),
        borderColor: "#7dd4a0",
        backgroundColor: "#7dd4a015",
        fill: false,
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: "#7dd4a0",
        tension: 0.3,
        yAxisID: "yP",
        order: 1,
        datasetLabelKind: "percentual-linha",
      });
    }

    if (showComCd && pointsCd) {
      datasets.push({
        type: "bar",
        label: "Valor c/ CD",
        data: pointsCd.map((p) => p.valor),
        backgroundColor: "#4a9e6e",
        borderColor: "#2d6b4a",
        borderWidth: 2,
        yAxisID: "yV",
        order: 5,
        datasetLabelKind: "valor-barra",
      });
      datasets.push({
        type: "line",
        label: "% c/ CD",
        data: pointsCd.map((p) => p.percentual),
        borderColor: "#2d6b4a",
        backgroundColor: "transparent",
        fill: false,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#2d6b4a",
        tension: 0.3,
        yAxisID: "yP",
        order: 2,
        borderDash: [4, 2],
        datasetLabelKind: "percentual-linha",
      });
    }

    datasets.push({
      type: "line",
      label: `Meta ${metaPercentual}%`,
      data: points.map(() => metaPercentual),
      borderColor: "rgba(255,255,255,.25)",
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
      yAxisID: "yP",
      order: 3,
    });

    datasets.push({
      type: "line",
      label: "DDE",
      data: points.map((p) => p.dde),
      borderColor: "#7a8b80",
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderDash: [3, 3],
      pointRadius: 3,
      pointBackgroundColor: "#7a8b80",
      tension: 0.3,
      yAxisID: "yD",
      order: 3,
      datasetLabelKind: "dde-linha",
    });

    const semCdMax = showSemCd ? Math.max(...points.map((p) => p.valor), 1) : 0;
    const comCdMax = showComCd && pointsCd ? Math.max(...pointsCd.map((p) => p.valor), 1) : 0;
    const rsScaleMax =
      showSemCd && showComCd ? Math.max(semCdMax, comCdMax) * 1.4 : Math.max(semCdMax, comCdMax, 1) * 1.1;

    return {
      type: "bar",
      data: { labels, datasets },
      plugins: [seriesValueLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { color: "rgba(26,46,34,.6)", usePointStyle: true, padding: 10, font: { size: 9 } },
          },
          tooltip: {
            ...tooltipBaseStyle,
            callbacks: {
              label: (item) => {
                const lbl = item.dataset.label || "";
                const raw = item.raw as number | null;
                if (lbl.includes("Valor s/")) return raw ? ` Valor s/ CD: ${formatCurrency(raw)}` : undefined;
                if (lbl.includes("Valor c/")) return raw ? ` Valor c/ CD: ${formatCurrency(raw)}` : undefined;
                if (lbl.includes("% s/")) return raw != null ? ` % s/ CD: ${raw.toFixed(2)}%` : undefined;
                if (lbl.includes("% c/")) return raw != null ? ` % c/ CD: ${raw.toFixed(2)}%` : undefined;
                if (lbl === "DDE" && raw != null) return ` DDE: ${Math.round(raw)}d`;
                return undefined;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "rgba(26,46,34,.4)", font: { size: 9 }, maxTicksLimit: 20 } },
          yP: {
            type: "linear",
            position: "left",
            grid: { color: "rgba(255,255,255,.04)" },
            ticks: { color: "#ff6b6b80", callback: (v) => `${v}%`, font: { size: 9 } },
          },
          yV: {
            type: "linear",
            position: "right",
            grid: { display: false },
            ticks: { display: false },
            max: rsScaleMax,
          },
          yD: {
            type: "linear",
            position: "right",
            display: false,
          },
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, pointsCd, showSemCd, showComCd, metaPercentual]);

  const canvasRef = useChart(config);
  return <canvas ref={canvasRef} role="img" aria-label="Evolução do segmento — % ruptura, DDE e dias de estoque" />;
}
