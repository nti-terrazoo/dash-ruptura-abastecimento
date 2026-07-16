import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client";
import type {
  BriefingResponse,
  BridgeDrilldownResponse,
  BridgeMode,
  BridgeResponse,
  ComiteResponse,
  DatesResponse,
  FornecedoresResponse,
  HealthResponse,
  LojaDetailResponse,
  LojasResponse,
  OverviewItemCriticoResponse,
  OverviewResponse,
  SegmentoDetailResponse,
  SegmentoSeriesResponse,
  SeriesResponse,
} from "./types";

/** O backend ja cacheia cada view por (view, data) com TTL de 30min - o
 * staleTime aqui evita refetches redundantes ao trocar de aba e voltar,
 * sem impedir que o botao "Atualizar" (invalidateQueries) force um refresh. */
const STALE_TIME_MS = 5 * 60 * 1000;

const defaultQueryOptions = {
  staleTime: STALE_TIME_MS,
  refetchOnWindowFocus: false,
} as const;

export const queryKeys = {
  health: ["health"] as const,
  dates: ["dates"] as const,
  overview: (date?: string) => ["overview", date] as const,
  overviewItemCritico: (date?: string) => ["overview-item-critico", date] as const,
  overviewSeries: (date: string | undefined, days: number, comCd: boolean) =>
    ["overview-series", date, days, comCd] as const,
  lojas: (date?: string) => ["lojas", date] as const,
  lojaDetail: (date: string | undefined, codUnidade: string) => ["loja-detail", date, codUnidade] as const,
  fornecedores: (date: string | undefined, segmento: string) => ["fornecedores", date, segmento] as const,
  bridge: (date: string | undefined, mode: BridgeMode, chave?: string | null) =>
    ["bridge", date, mode, chave] as const,
  bridgeDrilldown: (
    date: string | undefined,
    mode: BridgeMode,
    chave: string | null | undefined,
    statusLabel: string,
  ) => ["bridge-drilldown", date, mode, chave, statusLabel] as const,
  segmentoDetail: (date: string | undefined, segmento: string) => ["segmento-detail", date, segmento] as const,
  segmentoSeries: (date: string | undefined, segmento: string, days: number, comCd: boolean) =>
    ["segmento-series", date, segmento, days, comCd] as const,
  briefing: (date?: string) => ["briefing", date] as const,
  comite: (date?: string) => ["comite", date] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiGet<HealthResponse>("/api/health"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useDates() {
  return useQuery({
    queryKey: queryKeys.dates,
    queryFn: () => apiGet<DatesResponse>("/api/dates"),
    ...defaultQueryOptions,
  });
}

export function useOverview(date?: string) {
  return useQuery({
    queryKey: queryKeys.overview(date),
    queryFn: () => apiGet<OverviewResponse>("/api/overview", { date }),
    ...defaultQueryOptions,
  });
}

/** Separado de useOverview() de proposito: o item critico exige varrer a
 * bridge inteira no backend (a consulta mais lenta da Visao Geral), entao
 * fica numa query propria para nao segurar o resto dos KPIs - cada card
 * aparece assim que os dados dele chegam, em vez de tudo esperar a parte
 * mais lenta. */
export function useOverviewItemCritico(date?: string) {
  return useQuery({
    queryKey: queryKeys.overviewItemCritico(date),
    queryFn: () => apiGet<OverviewItemCriticoResponse>("/api/overview/item-critico", { date }),
    ...defaultQueryOptions,
  });
}

export function useOverviewSeries(date: string | undefined, days: 15 | 30 | 60, comCd: boolean, enabled = true) {
  return useQuery({
    queryKey: queryKeys.overviewSeries(date, days, comCd),
    queryFn: () => apiGet<SeriesResponse>("/api/overview/series", { date, days, cd: comCd }),
    enabled,
    ...defaultQueryOptions,
  });
}

export function useLojas(date?: string) {
  return useQuery({
    queryKey: queryKeys.lojas(date),
    queryFn: () => apiGet<LojasResponse>("/api/lojas", { date }),
    ...defaultQueryOptions,
  });
}

export function useLojaDetail(date: string | undefined, codUnidade: string | null) {
  return useQuery({
    queryKey: queryKeys.lojaDetail(date, codUnidade ?? ""),
    queryFn: () => apiGet<LojaDetailResponse>(`/api/lojas/${encodeURIComponent(codUnidade!)}`, { date }),
    enabled: Boolean(codUnidade),
    ...defaultQueryOptions,
  });
}

export function useFornecedores(date: string | undefined, segmento: string) {
  return useQuery({
    queryKey: queryKeys.fornecedores(date, segmento),
    queryFn: () => apiGet<FornecedoresResponse>("/api/fornecedores", { date, segmento }),
    ...defaultQueryOptions,
  });
}

/** Extraida para fora do hook para que o prefetch em segundo plano
 * (usePrefetchSecondaryPages) monte exatamente a mesma queryKey/queryFn -
 * garante que o cache batha quando o usuario navega ate a aba de verdade. */
export function bridgeQueryOptions(date: string | undefined, mode: BridgeMode, chave?: string | null) {
  return {
    queryKey: queryKeys.bridge(date, mode, chave),
    queryFn: () => apiGet<BridgeResponse>("/api/bridge", { date, mode, chave: chave ?? undefined }),
    ...defaultQueryOptions,
  };
}

export function useBridge(date: string | undefined, mode: BridgeMode, chave?: string | null) {
  return useQuery({
    ...bridgeQueryOptions(date, mode, chave),
    enabled: mode === "geral" || Boolean(chave),
  });
}

export function useBridgeDrilldown(
  date: string | undefined,
  mode: BridgeMode,
  chave: string | null | undefined,
  statusLabel: string | null,
) {
  return useQuery({
    queryKey: queryKeys.bridgeDrilldown(date, mode, chave, statusLabel ?? ""),
    queryFn: () =>
      apiGet<BridgeDrilldownResponse>("/api/bridge/drilldown", {
        date,
        mode,
        chave: chave ?? undefined,
        status_label: statusLabel!,
      }),
    enabled: Boolean(statusLabel),
    ...defaultQueryOptions,
  });
}

export function segmentoDetailQueryOptions(date: string | undefined, segmento: string) {
  return {
    queryKey: queryKeys.segmentoDetail(date, segmento),
    queryFn: () => apiGet<SegmentoDetailResponse>(`/api/segmentos/${encodeURIComponent(segmento)}`, { date }),
    ...defaultQueryOptions,
  };
}

export function useSegmentoDetail(date: string | undefined, segmento: string | null) {
  return useQuery({
    ...segmentoDetailQueryOptions(date, segmento ?? ""),
    enabled: Boolean(segmento),
  });
}

export function segmentoSeriesQueryOptions(
  date: string | undefined,
  segmento: string,
  days: 0 | 30 | 60,
  comCd: boolean,
) {
  return {
    queryKey: queryKeys.segmentoSeries(date, segmento, days, comCd),
    queryFn: () =>
      apiGet<SegmentoSeriesResponse>(`/api/segmentos/${encodeURIComponent(segmento)}/series`, {
        date,
        days,
        cd: comCd,
      }),
    ...defaultQueryOptions,
  };
}

export function useSegmentoSeries(
  date: string | undefined,
  segmento: string | null,
  days: 0 | 30 | 60,
  comCd: boolean,
  enabled = true,
) {
  return useQuery({
    ...segmentoSeriesQueryOptions(date, segmento ?? "", days, comCd),
    enabled: Boolean(segmento) && enabled,
  });
}

/** So busca depois que a senha do Briefing 9h e validada (`enabled`) - o
 * backend ja entrega isso pronto do cache aquecido as 1h (ver
 * app/jobs/cache_warmup.py), entao mesmo assim e instantaneo. */
export function useBriefing(date: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.briefing(date),
    queryFn: () => apiGet<BriefingResponse>("/api/briefing", { date }),
    enabled,
    ...defaultQueryOptions,
  });
}

/** Payload completo da Apresentacao Comite (sem gate de senha) - a data
 * usada e sempre a data selecionada na sidebar, nunca uma escolhida na
 * propria tela do Comite. */
export function useComite(date: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.comite(date),
    queryFn: () => apiGet<ComiteResponse>("/api/comite", { date }),
    enabled,
    ...defaultQueryOptions,
  });
}
