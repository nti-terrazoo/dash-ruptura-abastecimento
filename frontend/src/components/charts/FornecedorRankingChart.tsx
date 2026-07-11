import type { ChartConfiguration } from "chart.js";
import { useMemo } from "react";
import type { FornecedorRow } from "../../api/types";
import { formatCurrency } from "../../lib/format";
import { tooltipBaseStyle } from "./chartPlugins";
import { useChart } from "./useChart";
import "./chartSetup";

interface FornecedorRankingChartProps {
  rows: FornecedorRow[];
}

/** Barras horizontais Top 10 fornecedores por valor (R$) em ruptura -
 * equivalente ao `cForn` da aba Fornecedores no dashboard legado. */
export function FornecedorRankingChart({ rows }: FornecedorRankingChartProps) {
  const config = useMemo<ChartConfiguration<"bar">>(() => {
    const top10 = rows.slice(0, 10);
    return {
      type: "bar",
      data: {
        labels: top10.map((r) => (r.fornecedor.length > 22 ? `${r.fornecedor.slice(0, 22)}…` : r.fornecedor)),
        datasets: [
          {
            data: top10.map((r) => r.valor),
            backgroundColor: top10.map((_, i) => (i < 3 ? "#ffd166" : "rgba(94,217,160,.5)")),
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBaseStyle,
            callbacks: { label: (item) => `${formatCurrency(item.raw as number)} · ${top10[item.dataIndex].percentual.toFixed(2)}%` },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,.04)" },
            ticks: { color: "rgba(26,46,34,.45)", callback: (v) => formatCurrency(v as number) },
          },
          y: {
            grid: { display: false },
            ticks: { color: "rgba(26,46,34,.6)", font: { size: 9 } },
          },
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const canvasRef = useChart(config);
  return <canvas ref={canvasRef} role="img" aria-label="Ranking de fornecedores por valor em ruptura" />;
}
