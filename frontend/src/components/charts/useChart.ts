import { Chart, type ChartConfiguration } from "chart.js";
import { useEffect, useRef } from "react";

/**
 * Hook fino sobre o Chart.js "puro" (em vez do wrapper react-chartjs-2) -
 * os graficos deste dashboard usam eixos multiplos, tipos mistos (barra+
 * linha no mesmo `data.datasets`) e plugins customizados de desenho, exatamente
 * como o HTML legado (`new Chart(ctx, {...})`). Manter a mesma API imperativa
 * do Chart.js da mais controle para esse caso do que a abstracao do wrapper
 * React, sem abrir mao da lib (Chart.js) nem da tipagem (TS).
 *
 * Recria o grafico quando `config` muda (por referencia) - os componentes
 * que usam este hook devem memoizar `config` com `useMemo`.
 */
export function useChart<TType extends "bar" | "line">(config: ChartConfiguration<TType>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<TType> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  return canvasRef;
}
