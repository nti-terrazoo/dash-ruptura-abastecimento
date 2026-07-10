import type { ChartConfiguration } from "chart.js";
import { useMemo } from "react";
import type { SegmentoSeriePoint } from "../../api/types";
import { formatCurrency, formatDateShort } from "../../lib/format";
import { tooltipBaseStyle } from "./chartPlugins";
import { useChart } from "./useChart";
import "./chartSetup";

interface SegmentLineChartProps {
  points: SegmentoSeriePoint[];
  color: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Linha dupla eixo (Valor R$ em area + % Ruptura tracejado) - equivalente
 * ao `cSgLine` da aba Ruptura Segmentos no dashboard legado. */
export function SegmentLineChart({ points, color }: SegmentLineChartProps) {
  const config = useMemo<ChartConfiguration<"line">>(() => {
    const labels = points.map((p) => formatDateShort(p.data));

    return {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Valor R$",
            data: points.map((p) => p.valor),
            borderColor: color,
            backgroundColor: hexToRgba(color, 0.18),
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 3,
            yAxisID: "yV",
          },
          {
            label: "% Ruptura",
            data: points.map((p) => p.percentual),
            borderColor: "#ffd166",
            backgroundColor: "transparent",
            fill: false,
            tension: 0.4,
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 2,
            yAxisID: "yP",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { color: "rgba(26,46,34,.6)", usePointStyle: true, padding: 10, font: { size: 10 } },
          },
          tooltip: { ...tooltipBaseStyle },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, color: "rgba(26,46,34,.4)" } },
          yV: {
            type: "linear",
            position: "left",
            grid: { color: "rgba(45,107,74,.05)" },
            ticks: { color: "#3a4a3e", callback: (v) => formatCurrency(Number(v)) },
          },
          yP: {
            type: "linear",
            position: "right",
            grid: { display: false },
            ticks: { color: "#c8a04d", callback: (v) => `${v}%` },
          },
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, color]);

  const canvasRef = useChart(config);
  return <canvas ref={canvasRef} role="img" aria-label="Evolução do segmento" />;
}
