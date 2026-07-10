import type { ChartConfiguration } from "chart.js";
import { useMemo } from "react";
import type { BridgeStatusItem } from "../../api/types";
import { bridgeValueLabelsPlugin, tooltipBaseStyle } from "./chartPlugins";
import { useChart } from "./useChart";
import "./chartSetup";

interface BridgeWaterfallChartProps {
  metaPercentual: number;
  percentualAtual: number;
  valorAtual: number;
  statuses: BridgeStatusItem[];
  onStatusClick?: (status: BridgeStatusItem) => void;
}

/** Waterfall Meta -> (5 status da bridge, empilhados/flutuantes) -> Ruptura
 * Atual - equivalente ao `cBridge` do dashboard legado. Usa um dataset base
 * invisivel (stack) para "flutuar" cada barra de status a partir do ponto
 * onde a anterior terminou. */
export function BridgeWaterfallChart({
  metaPercentual,
  percentualAtual,
  valorAtual,
  statuses,
  onStatusClick,
}: BridgeWaterfallChartProps) {
  const config = useMemo<ChartConfiguration<"bar">>(() => {
    const labels = ["Meta", ...statuses.map((s) => s.label), "Ruptura Atual"];
    const colors = ["#2d6b4a", ...statuses.map((s) => s.color), "#ff6b6b"];

    const base: number[] = [0];
    let cumulative = metaPercentual;
    statuses.forEach((s) => {
      base.push(cumulative);
      cumulative += s.pp;
    });
    base.push(0);

    const bar = [metaPercentual, ...statuses.map((s) => s.pp), percentualAtual];
    const extra = [
      { pp: metaPercentual, valor: 0 },
      ...statuses.map((s) => ({ pp: s.pp, valor: s.valor })),
      { pp: percentualAtual, valor: valorAtual },
    ];

    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "base", data: base, backgroundColor: "rgba(0,0,0,0)", borderWidth: 0, stack: "w" },
          {
            label: "valor",
            data: bar,
            backgroundColor: colors,
            borderRadius: 5,
            stack: "w",
            // Campo extra lido pelo bridgeValueLabelsPlugin - nao faz parte do tipo ChartDataset,
            // mas o objeto e passado como está para chart.data e o plugin acessa via cast.
            extra,
          },
        ],
      },
      plugins: [bridgeValueLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => {
          if (!onStatusClick || !elements.length) return;
          const index = elements.find((el) => el.datasetIndex === 1)?.index;
          if (index === undefined || index === 0 || index === labels.length - 1) return;
          onStatusClick(statuses[index - 1]);
        },
        onHover: (event, elements) => {
          const target = event.native?.target as HTMLElement | undefined;
          if (!target) return;
          const clickable = elements.some((el) => {
            const idx = el.index;
            return el.datasetIndex === 1 && idx !== 0 && idx !== labels.length - 1;
          });
          target.style.cursor = clickable ? "pointer" : "default";
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBaseStyle,
            filter: (item) => item.datasetIndex === 1,
            callbacks: {
              label: (item) => `${(item.raw as number).toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#3a4a3e", font: { size: 9 } } },
          y: {
            stacked: true,
            grid: { color: "rgba(45,107,74,.06)" },
            ticks: { color: "#3a4a3e", callback: (v) => `${Number(v).toFixed(1)}%` },
          },
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaPercentual, percentualAtual, valorAtual, statuses, onStatusClick]);

  const canvasRef = useChart(config);
  return <canvas ref={canvasRef} role="img" aria-label="Waterfall de status da bridge" />;
}
