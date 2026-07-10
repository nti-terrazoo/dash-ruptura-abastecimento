import type { ChartConfiguration } from "chart.js";
import { useMemo } from "react";
import type { FornecedorRow } from "../../api/types";
import { tooltipBaseStyle } from "./chartPlugins";
import { useChart } from "./useChart";
import "./chartSetup";

interface FornecedorRankingChartProps {
  rows: FornecedorRow[];
}

/** Barras horizontais Top 10 fornecedores por % de ruptura - equivalente ao
 * `cForn` da aba Fornecedores no dashboard legado. */
export function FornecedorRankingChart({ rows }: FornecedorRankingChartProps) {
  const config = useMemo<ChartConfiguration<"bar">>(() => {
    const top10 = rows.slice(0, 10);
    return {
      type: "bar",
      data: {
        labels: top10.map((r) => r.fornecedor),
        datasets: [
          {
            label: "% Ruptura",
            data: top10.map((r) => r.percentual),
            backgroundColor: top10.map((r) => r.cor),
            borderRadius: 4,
            barThickness: 14,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipBaseStyle, callbacks: { label: (item) => `${(item.raw as number).toFixed(2)}%` } },
        },
        scales: {
          x: {
            grid: { color: "rgba(45,107,74,.06)" },
            ticks: { color: "rgba(26,46,34,.45)", callback: (v) => `${v}%` },
          },
          y: {
            grid: { display: false },
            ticks: { color: "rgba(26,46,34,.6)", font: { size: 10 } },
          },
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const canvasRef = useChart(config);
  return <canvas ref={canvasRef} role="img" aria-label="Ranking de fornecedores por percentual de ruptura" />;
}
