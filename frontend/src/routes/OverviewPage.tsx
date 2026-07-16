import { useState } from "react";
import { useOverview, useOverviewItemCritico, useOverviewSeries } from "../api/queries";
import { Card } from "../components/common/Card";
import { ChartContainer } from "../components/common/ChartContainer";
import { ErrorState } from "../components/common/ErrorState";
import { FilterPill } from "../components/common/FilterPill";
import { KpiCardSkeleton, Skeleton } from "../components/common/Skeleton";
import { KpiCard } from "../components/kpi/KpiCard";
import { SeriesChart } from "../components/charts/SeriesChart";
import { formatCurrency, formatDateFull, formatDateShort, formatDde, formatPercent } from "../lib/format";
import { segmentColor } from "../lib/segmentos";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { usePrefetchSecondaryPages } from "../hooks/usePrefetchSecondaryPages";
import styles from "./OverviewPage.module.css";

const DAYS_OPTIONS = [15, 30, 60] as const;

export function OverviewPage() {
  const { selectedDate } = useSelectedDate();
  const overviewQuery = useOverview(selectedDate);
  const itemCriticoQuery = useOverviewItemCritico(selectedDate);
  usePrefetchSecondaryPages(selectedDate);
  const [days, setDays] = useState<(typeof DAYS_OPTIONS)[number]>(15);
  const [showSemCd, setShowSemCd] = useState(true);
  const [showComCd, setShowComCd] = useState(true);

  const semCdSeries = useOverviewSeries(selectedDate, days, false, showSemCd);
  const comCdSeries = useOverviewSeries(selectedDate, days, true, showComCd);

  function toggleSemCd() {
    setShowSemCd((prev) => (prev && !showComCd ? prev : !prev));
  }
  function toggleComCd() {
    setShowComCd((prev) => (prev && !showSemCd ? prev : !prev));
  }

  if (overviewQuery.isError) return <ErrorState error={overviewQuery.error} />;

  const data = overviewQuery.data;

  const activeSeries = showSemCd ? semCdSeries.data?.pontos : comCdSeries.data?.pontos;
  const rangeLabel =
    activeSeries && activeSeries.length > 0
      ? `${formatDateShort(activeSeries[0].data)}–${formatDateShort(activeSeries[activeSeries.length - 1].data)}`
      : null;

  const itemCritico = itemCriticoQuery.data?.item_critico;
  const criticoSegCor = itemCritico?.segmento ? segmentColor(itemCritico.segmento) : undefined;

  return (
    <div>
      <div className="grid-4">
        {!data ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="% Ruptura"
              value={
                <>
                  <span className={styles.kpiMainValue} style={{ color: "#ff9999" }}>
                    {formatPercent(data.ruptura_sem_cd.percentual)}
                  </span>
                  <div className={styles.kpiSubLabel}>s/ CD</div>
                  {data.ruptura_com_cd.percentual > 0 && (
                    <div className={styles.kpiSecondary}>
                      {formatPercent(data.ruptura_com_cd.percentual)}{" "}
                      <span className={styles.kpiSecondarySuffix}>c/ CD</span>
                    </div>
                  )}
                </>
              }
              tag={{
                text:
                  data.ruptura_sem_cd.percentual <= data.meta_percentual
                    ? "✓ Dentro da meta"
                    : `▲ +${(data.ruptura_sem_cd.percentual - data.meta_percentual).toFixed(2)}pp acima meta`,
                tone: data.ruptura_sem_cd.percentual <= data.meta_percentual ? "good" : "bad",
              }}
              sub={`${formatDateFull(data.data_referencia)} · Meta: ${data.meta_percentual}%`}
            />
            <KpiCard
              label="Valor em Ruptura"
              value={
                <>
                  <span className={styles.kpiMainValue} style={{ color: "#ffd166" }}>
                    {formatCurrency(data.ruptura_sem_cd.valor)}
                  </span>
                  <div className={styles.kpiSubLabel}>s/ CD</div>
                  {data.ruptura_com_cd.valor > 0 && (
                    <div className={styles.kpiSecondary}>
                      {formatCurrency(data.ruptura_com_cd.valor)}{" "}
                      <span className={styles.kpiSecondarySuffix}>c/ CD</span>
                    </div>
                  )}
                </>
              }
              sub={formatDateFull(data.data_referencia)}
            />
            <KpiCard label="DDE Geral" value={<span style={{ fontSize: 40 }}>{formatDde(data.dde_geral)}</span>} valueColor="#7dd4a0" centered>
              <div className={styles.ddeSubLabel}>Dias de estoque · Hoje</div>
              <div className={styles.topList}>
                {data.top_fornecedores_dde.map((f) => (
                  <div key={f.fornecedor} className={styles.ddeFornRow}>
                    <span className={styles.ddeFornName}>{f.fornecedor.split(" ").slice(0, 2).join(" ")}</span>
                    <span className={styles.ddeFornValue}>{formatDde(f.dde)}</span>
                  </div>
                ))}
              </div>
            </KpiCard>
            <KpiCard label="Top 3 Segmentos (%)" value="">
              <div className={styles.topSegList}>
                {data.top_segmentos.map((s, i) => (
                  <div
                    key={s.segmento}
                    className={styles.segTopRow}
                    style={i > 0 ? { paddingTop: 4, borderTop: "1px solid rgba(255,255,255,.1)" } : undefined}
                  >
                    <span className={styles.segTopName} style={{ fontSize: i === 0 ? 16 : i === 1 ? 13 : 11 }}>
                      {s.segmento}
                    </span>
                    <span className={styles.segTopPct} style={{ fontSize: i === 0 ? 18 : i === 1 ? 14 : 12 }}>
                      {formatPercent(s.percentual, 1)}
                    </span>
                  </div>
                ))}
              </div>
            </KpiCard>
          </>
        )}
      </div>

      <div className={styles.topRow}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className={styles.segHeader}>
            <span className={styles.segHeaderTitle}>Ruptura por Segmento</span>
            <span className={styles.segHeaderPill}>hoje</span>
          </div>
          {!data ? (
            <div style={{ padding: "10px 17px" }}>
              <Skeleton height={140} />
            </div>
          ) : (
            <div className={styles.segBody}>
              {data.ruptura_por_segmento.map((s) => (
                <div key={s.segmento} className={styles.segRowItem}>
                  <div className={styles.segRowTop}>
                    <span className={styles.segRowLabel}>{s.segmento}</span>
                    <span className={styles.segRowPct} style={{ color: s.cor }}>
                      {formatPercent(s.percentual, 1)}
                    </span>
                  </div>
                  <div className={styles.segRowBottom}>
                    <span className={styles.segRowValue}>{formatCurrency(s.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card style={{ padding: "12px 14px" }}>
          <div className={styles.criticoHeader}>
            <span className={styles.criticoDot} />
            <span className={styles.criticoTitle}>Item Mais Crítico</span>
            <span className={styles.criticoDate}>
              {itemCriticoQuery.data ? formatDateFull(itemCriticoQuery.data.data_referencia) : "—"}
            </span>
          </div>
          {itemCriticoQuery.isError ? (
            <div style={{ fontSize: 11, color: "var(--red)" }}>Não foi possível carregar o item crítico.</div>
          ) : itemCriticoQuery.isLoading ? (
            <Skeleton height={140} />
          ) : !itemCritico ? (
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Nenhum item crítico encontrado.</div>
          ) : (
            <div className={styles.criticoBody}>
              <div>
                <div className={styles.criticoFieldLabel}>Produto</div>
                <div className={styles.criticoProduto}>{itemCritico.produto ?? "—"}</div>
              </div>
              <div className={styles.criticoRow}>
                <div>
                  <div className={styles.criticoFieldLabel}>Loja</div>
                  <div className={styles.criticoLoja}>{itemCritico.loja ?? "—"}</div>
                </div>
                <div>
                  <div className={styles.criticoFieldLabel}>Seg.</div>
                  <div className={styles.criticoSeg} style={{ color: criticoSegCor ?? "var(--g1)" }}>
                    {itemCritico.segmento ?? "—"}
                  </div>
                </div>
              </div>
              <div>
                <div className={styles.criticoFieldLabel}>Valor Ruptura</div>
                <div className={styles.criticoValor}>{formatCurrency(itemCritico.valor)}</div>
              </div>
              {(itemCritico.status_label ?? itemCritico.situacao) && (
                <div className={styles.criticoStatus}>{itemCritico.status_label ?? itemCritico.situacao}</div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Evolução Diária — % Ruptura + DDE"
        actions={
          <div className={styles.chartControls}>
            {DAYS_OPTIONS.map((d) => (
              <FilterPill key={d} active={days === d} onClick={() => setDays(d)}>
                {d}d
              </FilterPill>
            ))}
            <span className={styles.chartControlsSep}>|</span>
            <FilterPill active={showSemCd} onClick={toggleSemCd}>
              s/ CD
            </FilterPill>
            <FilterPill active={showComCd} onClick={toggleComCd}>
              c/ CD
            </FilterPill>
            {rangeLabel && <span className={styles.chartRangePill}>{rangeLabel}</span>}
          </div>
        }
      >
        {!data || (showSemCd && semCdSeries.isLoading) || (showComCd && comCdSeries.isLoading) ? (
          <Skeleton height={340} />
        ) : (
          <ChartContainer height={340} title="Evolução Diária — % Ruptura + DDE">
            <SeriesChart
              points={semCdSeries.data?.pontos ?? []}
              pointsCd={comCdSeries.data?.pontos}
              showSemCd={showSemCd}
              showComCd={showComCd}
              metaPercentual={data.meta_percentual}
            />
          </ChartContainer>
        )}
      </Card>
    </div>
  );
}
