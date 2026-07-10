import type { ChartConfiguration, ChartDataset } from "chart.js";
import { useMemo } from "react";
import type { SeriePoint } from "../../api/types";
import { formatDateShort } from "../../lib/format";
import { gridStyle, seriesValueLabelsPlugin, tooltipBaseStyle } from "./chartPlugins";
import { useChart } from "./useChart";
import "./chartSetup";

type LabeledDataset = ChartDataset<"bar" | "line", (number | null)[]> & { datasetLabelKind?: string };

interface SeriesChartProps {
  points: SeriePoint[];
  pointsCd?: SeriePoint[];
  showSemCd: boolean;
  showComCd: boolean;
  metaPercentual: number;
}

/** Combo barra+linha com 2 eixos (% e R$) - equivalente ao `cSerie` da Visao
 * Geral no dashboard legado ("Evolução Diária"). */
export function SeriesChart({ points, pointsCd, showSemCd, showComCd, metaPercentual }: SeriesChartProps) {
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
        pointRadius: 4,
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
        pointRadius: 3,
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
      borderColor: "rgba(45,107,74,.35)",
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
      yAxisID: "yP",
      order: 3,
    });

    const maxValor = Math.max(1, ...points.map((p) => p.valor), ...(pointsCd?.map((p) => p.valor) ?? []));

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
          tooltip: { ...tooltipBaseStyle },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "rgba(26,46,34,.4)", font: { size: 9 } } },
          yP: {
            type: "linear",
            position: "left",
            grid: gridStyle,
            ticks: { color: "rgba(58,127,213,.6)", callback: (v) => `${v}%`, font: { size: 9 } },
            min: 0,
          },
          yV: {
            type: "linear",
            position: "right",
            grid: { display: false },
            ticks: { display: false },
            max: maxValor * 1.8,
          },
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, pointsCd, showSemCd, showComCd, metaPercentual]);

  const canvasRef = useChart(config);
  return <canvas ref={canvasRef} role="img" aria-label="Evolução diária de ruptura" />;
}
