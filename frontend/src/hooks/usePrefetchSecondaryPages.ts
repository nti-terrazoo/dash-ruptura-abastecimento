import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bridgeQueryOptions, segmentoDetailQueryOptions, segmentoSeriesQueryOptions } from "../api/queries";
import { SEGMENTOS } from "../lib/segmentos";

/**
 * Dispara em segundo plano, assim que a Visao Geral termina de montar, as
 * mesmas consultas que as abas Bridge/CD (modo "geral") e Ruptura Segmentos
 * (primeiro segmento, mes atual) fazem na visao padrao delas. Usa as mesmas
 * queryOptions (queryKey + queryFn) dos hooks reais dessas paginas, entao
 * quando o usuario navega ate la o react-query encontra o cache pronto e
 * nao refaz a requisicao.
 *
 * A bridge geral em particular e a consulta mais lenta do dashboard (varre
 * a VW_DASH_LOJAS_BRIDGE inteira - ver dashboard_service.get_bridge/
 * get_overview_item_critico no backend), entao aquecer o cache dela
 * enquanto o usuario ainda esta lendo a Visao Geral e o que mais reduz a
 * espera percebida ao trocar de aba.
 *
 * A serie do segmento e prefetchada nas duas variantes (s/CD e c/CD) porque
 * SegmentosPage mostra as duas ligadas por padrao - o warm-up diario
 * (app/jobs/cache_warmup.py no backend) cobre as demais janelas/segmentos.
 */
export function usePrefetchSecondaryPages(selectedDate: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!selectedDate) return;
    const defaultSegmento = SEGMENTOS[0];

    void queryClient.prefetchQuery(bridgeQueryOptions(selectedDate, "geral"));
    void queryClient.prefetchQuery(segmentoDetailQueryOptions(selectedDate, defaultSegmento));
    void queryClient.prefetchQuery(segmentoSeriesQueryOptions(selectedDate, defaultSegmento, 0, false));
    void queryClient.prefetchQuery(segmentoSeriesQueryOptions(selectedDate, defaultSegmento, 0, true));
  }, [selectedDate, queryClient]);
}
