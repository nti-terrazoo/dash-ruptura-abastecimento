import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client";
import type {
  BridgeDrilldownResponse,
  BridgeMode,
  BridgeResponse,
  DatesResponse,
  FornecedoresResponse,
  HealthResponse,
  LojaDetailResponse,
  LojasResponse,
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

export function useBridge(date: string | undefined, mode: BridgeMode, chave?: string | null) {
  return useQuery({
    queryKey: queryKeys.bridge(date, mode, chave),
    queryFn: () => apiGet<BridgeResponse>("/api/bridge", { date, mode, chave: chave ?? undefined }),
    enabled: mode === "geral" || Boolean(chave),
    ...defaultQueryOptions,
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

export function useSegmentoDetail(date: string | undefined, segmento: string | null) {
  return useQuery({
    queryKey: queryKeys.segmentoDetail(date, segmento ?? ""),
    queryFn: () => apiGet<SegmentoDetailResponse>(`/api/segmentos/${encodeURIComponent(segmento!)}`, { date }),
    enabled: Boolean(segmento),
    ...defaultQueryOptions,
  });
}

export function useSegmentoSeries(date: string | undefined, segmento: string | null, days: 15 | 30 | 60, comCd: boolean) {
  return useQuery({
    queryKey: queryKeys.segmentoSeries(date, segmento ?? "", days, comCd),
    queryFn: () =>
      apiGet<SegmentoSeriesResponse>(`/api/segmentos/${encodeURIComponent(segmento!)}/series`, {
        date,
        days,
        cd: comCd,
      }),
    enabled: Boolean(segmento),
    ...defaultQueryOptions,
  });
}
