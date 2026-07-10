import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSegmentoDetail, useSegmentoSeries } from "../api/queries";
import { Card } from "../components/common/Card";
import { ChartContainer } from "../components/common/ChartContainer";
import { DataTable } from "../components/common/DataTable";
import { ErrorState } from "../components/common/ErrorState";
import { FilterPill } from "../components/common/FilterPill";
import { Skeleton } from "../components/common/Skeleton";
import { SegmentLineChart } from "../components/charts/SegmentLineChart";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { formatCurrency, formatDateShort, formatDde, formatPercent } from "../lib/format";
import { SEGMENTOS } from "../lib/segmentos";
import styles from "./SegmentosPage.module.css";

const DAYS_OPTIONS = [15, 30, 60] as const;

export function SegmentosPage() {
  // Garantido pela rota em App.tsx (/segmentos/:segmento) - a rota index
  // /segmentos redireciona antes de este componente ser montado.
  const { segmento = SEGMENTOS[0] } = useParams<{ segmento: string }>();
  const navigate = useNavigate();
  const { selectedDate } = useSelectedDate();
  const [days, setDays] = useState<(typeof DAYS_OPTIONS)[number]>(30);
  const [comCd, setComCd] = useState(false);

  const detailQuery = useSegmentoDetail(selectedDate, segmento);
  const seriesQuery = useSegmentoSeries(selectedDate, segmento, days, comCd);

  if (detailQuery.isError) return <ErrorState error={detailQuery.error} />;
  const data = detailQuery.data;

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.segName}>{segmento}</div>
          </div>
          {data && (
            <div className={styles.headerStats}>
              <div className={styles.headerStat}>
                <div className={styles.headerStatLabel}>% Ruptura</div>
                <div className={styles.headerStatValue} style={{ color: "#ff9999" }}>
                  {formatPercent(data.percentual)}
                </div>
              </div>
              <div className={styles.headerStat}>
                <div className={styles.headerStatLabel}>Valor</div>
                <div className={styles.headerStatValue} style={{ color: "#ffd166" }}>
                  {formatCurrency(data.valor)}
                </div>
              </div>
              <div className={styles.headerStat}>
                <div className={styles.headerStatLabel}>Meta</div>
                <div className={styles.headerStatValue}>{data.meta_percentual ?? "—"}%</div>
              </div>
              <div className={styles.headerStat}>
                <div className={styles.headerStatLabel}>DDE (meta mês)</div>
                <div className={styles.headerStatValue} style={{ color: "#ffd166" }}>
                  {formatDde(data.dde)} <span style={{ fontSize: 11, opacity: 0.7 }}>/ {formatDde(data.dde_meta)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.pillsRow}>
          {SEGMENTOS.map((s) => (
            <FilterPill key={s} active={segmento === s} onClick={() => navigate(`/segmentos/${s}`)} onDark>
              {s}
            </FilterPill>
          ))}
        </div>

        <div className={styles.controlsRow}>
          {DAYS_OPTIONS.map((d) => (
            <FilterPill key={d} active={days === d} onClick={() => setDays(d)} onDark>
              {d}d
            </FilterPill>
          ))}
          <FilterPill active={comCd} onClick={() => setComCd((v) => !v)} onDark>
            c/CD
          </FilterPill>
        </div>
      </div>

      <div className="grid-3-2">
        <Card title="Evolução do Segmento">
          {seriesQuery.isLoading ? (
            <Skeleton height={260} />
          ) : (
            <ChartContainer height={260} title={`Evolução — ${segmento}`}>
              <SegmentLineChart points={seriesQuery.data?.pontos ?? []} color={data?.cor ?? "#2d6b4a"} />
            </ChartContainer>
          )}
        </Card>

        <Card title="Breakdown da Bridge">
          {!data ? (
            <Skeleton height={200} />
          ) : (
            <div>
              {data.bridge.map((b) => (
                <div key={b.label} className={styles.bridgeItem}>
                  <span>
                    <span className={styles.bridgeDot} style={{ background: b.color }} />
                    {b.label}
                  </span>
                  <span>
                    {formatPercent(b.pp, 1)} · {formatCurrency(b.valor)}
                  </span>
                </div>
              ))}
              {data.item_critico && (
                <>
                  <div className="section-title" style={{ marginTop: 14 }}>
                    Top Item Crítico
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text)" }}>
                    {data.item_critico.produto} — {data.item_critico.loja} ({formatCurrency(data.item_critico.valor)})
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card title="Top 10 Fornecedores — Últimos 3 Dias">
        {!data ? (
          <Skeleton height={260} />
        ) : (
          <DataTable
            columns={[
              { key: "fornecedor", header: "Fornecedor", render: (r) => r.fornecedor },
              ...(data.top_fornecedores_ultimos_dias[0]?.dias.map((d, dayIndex) => ({
                key: `dia-${dayIndex}`,
                header: formatDateShort(d.data),
                align: "right" as const,
                render: (r: (typeof data.top_fornecedores_ultimos_dias)[number]) => {
                  const dia = r.dias[dayIndex];
                  return dia ? `${formatPercent(dia.percentual, 1)} · ${formatCurrency(dia.valor)}` : "—";
                },
              })) ?? []),
            ]}
            rows={data.top_fornecedores_ultimos_dias}
            keyExtractor={(r) => r.fornecedor}
            showRank
          />
        )}
      </Card>
    </div>
  );
}
