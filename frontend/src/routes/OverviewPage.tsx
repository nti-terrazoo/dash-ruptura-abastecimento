import { useState } from "react";
import { useOverview, useOverviewSeries } from "../api/queries";
import { Card } from "../components/common/Card";
import { ChartContainer } from "../components/common/ChartContainer";
import { ErrorState } from "../components/common/ErrorState";
import { FilterPill } from "../components/common/FilterPill";
import { LabeledProgressBar } from "../components/common/ProgressBar";
import { KpiCardSkeleton, Skeleton } from "../components/common/Skeleton";
import { KpiCard } from "../components/kpi/KpiCard";
import { SeriesChart } from "../components/charts/SeriesChart";
import { formatCurrency, formatDde, formatPercent } from "../lib/format";
import { useSelectedDate } from "../hooks/useSelectedDate";
import styles from "./OverviewPage.module.css";

const DAYS_OPTIONS = [15, 30, 60] as const;

export function OverviewPage() {
  const { selectedDate } = useSelectedDate();
  const overviewQuery = useOverview(selectedDate);
  const [days, setDays] = useState<(typeof DAYS_OPTIONS)[number]>(15);
  const [showSemCd, setShowSemCd] = useState(true);
  const [showComCd, setShowComCd] = useState(false);

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
              value={formatPercent(data.ruptura_sem_cd.percentual)}
              tag={{
                text:
                  data.ruptura_sem_cd.percentual <= data.meta_percentual
                    ? "✓ Dentro da meta"
                    : `+${(data.ruptura_sem_cd.percentual - data.meta_percentual).toFixed(2)}pp acima meta`,
                tone: data.ruptura_sem_cd.percentual <= data.meta_percentual ? "good" : "bad",
              }}
              sub={`c/ CD: ${formatPercent(data.ruptura_com_cd.percentual)}`}
            />
            <KpiCard
              label="Valor em Ruptura"
              value={formatCurrency(data.ruptura_sem_cd.valor)}
              valueColor="#ffd166"
              sub={`c/ CD: ${formatCurrency(data.ruptura_com_cd.valor)}`}
            />
            <KpiCard label="DDE Geral" value={formatDde(data.dde_geral)} valueColor="#7dd4a0" centered>
              <div className={styles.topList}>
                {data.top_fornecedores_dde.map((f) => (
                  <div key={f.fornecedor}>
                    {f.fornecedor} · {formatDde(f.dde)}
                  </div>
                ))}
              </div>
            </KpiCard>
            <KpiCard label="Top 3 Segmentos (%)" value="">
              <div className={styles.topSegList}>
                {data.top_segmentos.map((s, i) => (
                  <div key={s.segmento} style={{ fontSize: i === 0 ? 16 : i === 1 ? 13 : 11, color: "#ffffff" }}>
                    {s.segmento} · {formatPercent(s.percentual)}
                  </div>
                ))}
              </div>
            </KpiCard>
          </>
        )}
      </div>

      <div className="grid-3-2">
        <Card title="Ruptura por Segmento">
          {!data ? (
            <Skeleton height={140} />
          ) : (
            <div className={styles.segRowGrid}>
              {data.ruptura_por_segmento.map((s) => (
                <LabeledProgressBar
                  key={s.segmento}
                  label={s.segmento}
                  valueLabel={formatPercent(s.percentual)}
                  percent={s.percentual}
                  color={s.cor}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Item Mais Crítico">
          {!data ? (
            <Skeleton height={140} />
          ) : !data.item_critico ? (
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Nenhum item crítico encontrado.</div>
          ) : (
            <div>
              <div className={styles.criticoField}>
                <span className={styles.criticoLabel}>Produto</span>
                <span className={styles.criticoValue}>{data.item_critico.produto ?? "—"}</span>
              </div>
              <div className={styles.criticoField}>
                <span className={styles.criticoLabel}>Loja</span>
                <span className={styles.criticoValue}>{data.item_critico.loja ?? "—"}</span>
              </div>
              <div className={styles.criticoField}>
                <span className={styles.criticoLabel}>Segmento</span>
                <span className={styles.criticoValue}>{data.item_critico.segmento ?? "—"}</span>
              </div>
              <div className={styles.criticoField}>
                <span className={styles.criticoLabel}>Fornecedor</span>
                <span className={styles.criticoValue}>{data.item_critico.fornecedor ?? "—"}</span>
              </div>
              <div className={styles.criticoField}>
                <span className={styles.criticoLabel}>Valor</span>
                <span className={styles.criticoValue}>{formatCurrency(data.item_critico.valor)}</span>
              </div>
              <div className={styles.criticoField} style={{ borderBottom: "none" }}>
                <span className={styles.criticoLabel}>Status</span>
                <span className={styles.criticoValue}>{data.item_critico.status_label ?? data.item_critico.situacao ?? "—"}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Evolução Diária"
        actions={
          <div className={styles.chartControls}>
            {DAYS_OPTIONS.map((d) => (
              <FilterPill key={d} active={days === d} onClick={() => setDays(d)}>
                {d}d
              </FilterPill>
            ))}
            <FilterPill active={showSemCd} onClick={toggleSemCd}>
              s/CD
            </FilterPill>
            <FilterPill active={showComCd} onClick={toggleComCd}>
              c/CD
            </FilterPill>
          </div>
        }
      >
        {!data || (showSemCd && semCdSeries.isLoading) || (showComCd && comCdSeries.isLoading) ? (
          <Skeleton height={280} />
        ) : (
          <ChartContainer height={280} title="Evolução Diária">
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
