import { Fragment, useState, type CSSProperties } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSegmentoDetail, useSegmentoSeries } from "../api/queries";
import type { FornecedorHistorico } from "../api/types";
import { Card } from "../components/common/Card";
import { ChartContainer } from "../components/common/ChartContainer";
import { ErrorState } from "../components/common/ErrorState";
import { FilterPill } from "../components/common/FilterPill";
import { Skeleton } from "../components/common/Skeleton";
import { SegmentEvolutionChart } from "../components/charts/SegmentEvolutionChart";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { formatCurrency, formatDateShort, formatDde, formatPercent } from "../lib/format";
import { SEGMENTOS } from "../lib/segmentos";
import styles from "./SegmentosPage.module.css";

const DAYS_OPTIONS = [
  { value: 0, label: "Mês" },
  { value: 30, label: "30d" },
  { value: 60, label: "60d" },
] as const;

/** Rótulos abreviados dos status da bridge para o painel lateral estreito
 * (260px) - iguais aos usados em `selRS()` no dashboard legado. */
const BRIDGE_LABEL_SHORT: Record<string, string> = {
  "Sit. Crítica c/ Pedido": "Sit. c/ Pedido",
  "Sit. Crítica s/ Pedido": "Sit. s/ Pedido",
  "CD Insuficiente": "CD Insuf.",
  "CD Atende Loja": "CD Atende",
  "Estoque Negativo": "Est. Neg.",
};

function diaFor(f: FornecedorHistorico, data: string) {
  return f.dias.find((d) => d.data === data);
}

export function SegmentosPage() {
  // Garantido pela rota em App.tsx (/segmentos/:segmento) - a rota index
  // /segmentos redireciona antes de este componente ser montado.
  const { segmento = SEGMENTOS[0] } = useParams<{ segmento: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedDate } = useSelectedDate();
  const [days, setDays] = useState<(typeof DAYS_OPTIONS)[number]["value"]>(0);
  const [showSemCd, setShowSemCd] = useState(true);
  const [showComCd, setShowComCd] = useState(false);

  const detailQuery = useSegmentoDetail(selectedDate, segmento);
  const semCdSeries = useSegmentoSeries(selectedDate, segmento, days, false, showSemCd);
  const comCdSeries = useSegmentoSeries(selectedDate, segmento, days, true, showComCd);

  if (detailQuery.isError) return <ErrorState error={detailQuery.error} />;
  const data = detailQuery.data;

  function toggleSemCd() {
    setShowSemCd((prev) => (prev && !showComCd ? prev : !prev));
  }
  function toggleComCd() {
    setShowComCd((prev) => (prev && !showSemCd ? prev : !prev));
  }

  const ok = data ? !data.acima_meta : true;
  const ddeStatus =
    !data || data.dde == null || data.dde_meta == null
      ? { text: "DDE —", tone: "neutral" as const }
      : data.dde <= data.dde_meta
        ? { text: "DDE ✓ Meta", tone: "ok" as const }
        : { text: `DDE ▲ +${Math.round(data.dde - data.dde_meta)}d`, tone: "crit" as const };

  const allDates = Array.from(
    new Set(data?.top_fornecedores_ultimos_dias.flatMap((f) => f.dias.map((d) => d.data)) ?? []),
  )
    .sort()
    .slice(-3);

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.segBlock}>
          <div className={styles.segEyebrow}>Segmento</div>
          <div className={styles.segName}>{segmento}</div>
        </div>

        {data && (
          <div className={styles.headerStats}>
            <div>
              <div className={styles.headerStatLabel}>% Ruptura</div>
              <div className={styles.headerStatValue} style={{ color: ok ? "#a8f0c8" : "#ff9999" }}>
                {formatPercent(data.percentual)}
              </div>
            </div>
            <div>
              <div className={styles.headerStatLabel}>Valor R$</div>
              <div className={styles.headerStatValue} style={{ color: "#ffd166" }}>
                {formatCurrency(data.valor)}
              </div>
            </div>
            <div>
              <div className={styles.headerStatLabel}>Meta</div>
              <div className={styles.headerStatValue}>{data.meta_percentual != null ? `${data.meta_percentual}%` : "—"}</div>
            </div>
            <div>
              <div className={styles.headerStatLabel}>DDE</div>
              <div className={styles.headerStatValue} style={{ color: "#ffd166" }}>
                {formatDde(data.dde)}
                {data.dde_meta != null && (
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginLeft: 4 }}>
                    / meta {formatDde(data.dde_meta)}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.headerStatusCol}>
              <span className={`${styles.statusBadge} ${ok ? styles.statusBadgeOk : styles.statusBadgeCrit}`}>
                {ok ? "✓ Meta" : "Acima da meta"}
              </span>
              <span
                className={`${styles.statusBadge} ${
                  ddeStatus.tone === "ok"
                    ? styles.statusBadgeOk
                    : ddeStatus.tone === "crit"
                      ? styles.statusBadgeCrit
                      : styles.statusBadgeNeutral
                }`}
              >
                {ddeStatus.text}
              </span>
            </div>
          </div>
        )}

        <div className={styles.headerRight}>
          <div className={styles.pillsRow}>
            {SEGMENTOS.map((s) => (
              <FilterPill
                key={s}
                active={segmento === s}
                onClick={() => navigate({ pathname: `/segmentos/${s}`, search: location.search })}
                onDark
              >
                {s}
              </FilterPill>
            ))}
          </div>
          <div className={styles.controlsRow}>
            <span className={styles.controlsLabel}>PERÍODO:</span>
            {DAYS_OPTIONS.map((d) => (
              <FilterPill key={d.value} active={days === d.value} onClick={() => setDays(d.value)} onDark>
                {d.label}
              </FilterPill>
            ))}
            <span className={`${styles.controlsLabel} ${styles.controlsSep}`}>VISÃO:</span>
            <FilterPill active={showSemCd} onClick={toggleSemCd} onDark>
              s/ CD
            </FilterPill>
            <FilterPill active={showComCd} onClick={toggleComCd} onDark>
              c/ CD
            </FilterPill>
          </div>
        </div>
      </div>

      <div className={styles.mainRow}>
        <Card title="% Ruptura · DDE · Dias de Estoque" actions={<span className={styles.cbPill}>{segmento}</span>}>
          {!data || (showSemCd && semCdSeries.isLoading) || (showComCd && comCdSeries.isLoading) ? (
            <Skeleton height={360} />
          ) : (
            <ChartContainer height={360} title={`% Ruptura · DDE · Dias de Estoque — ${segmento}`}>
              <SegmentEvolutionChart
                points={semCdSeries.data?.pontos ?? []}
                pointsCd={comCdSeries.data?.pontos}
                showSemCd={showSemCd}
                showComCd={showComCd}
                metaPercentual={data.meta_percentual ?? 10}
              />
            </ChartContainer>
          )}
        </Card>

        <div className={styles.sidePanel}>
          {!data ? (
            <Skeleton height={200} />
          ) : (
            <>
              {data.bridge.map((b) => (
                <div key={b.label} className={styles.bridgeCard} style={{ "--bc": b.color } as CSSProperties}>
                  <div className={styles.bridgeCardLabel}>{BRIDGE_LABEL_SHORT[b.label] ?? b.label}</div>
                  <div className={styles.bridgeCardPp}>{formatPercent(b.pp, 2)}pp</div>
                  <div className={styles.bridgeCardValue}>{formatCurrency(b.valor)}</div>
                </div>
              ))}

              <div className={styles.topItemCard}>
                {data.item_critico ? (
                  <>
                    <div className={styles.topItemEyebrow}>⭐ Top Item Crítico</div>
                    <div className={styles.topItemName}>{data.item_critico.produto ?? "—"}</div>
                    <div className={styles.topItemLoja}>{data.item_critico.loja ?? "—"}</div>
                    <div className={styles.topItemValue}>{formatCurrency(data.item_critico.valor)}</div>
                  </>
                ) : (
                  <div className={styles.topItemEmpty}>—</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Card
        title="🏭 Top 10 Fornecedores — Últimos 3 Dias"
        actions={<span className={styles.cbPill}>{allDates.map((d) => formatDateShort(d)).join(" · ")}</span>}
      >
        {!data ? (
          <Skeleton height={260} />
        ) : (
          <div className={styles.fornTableWrap}>
            <table className={styles.fornTable}>
              <thead>
                <tr>
                  <th rowSpan={2}>#</th>
                  <th rowSpan={2}>Fornecedor</th>
                  {allDates.map((d) => (
                    <th key={d} colSpan={3} className={styles.fornDayGroupHeader}>
                      {formatDateShort(d)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {allDates.map((d) => (
                    <Fragment key={d}>
                      <th className={styles.fornDaySubHeader}>%</th>
                      <th className={styles.fornDaySubHeader}>R$</th>
                      <th className={styles.fornDaySubHeader} style={{ color: "#ffd166" }}>
                        DDE
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.top_fornecedores_ultimos_dias.map((f, i) => (
                  <tr key={f.fornecedor} style={{ background: i % 2 === 0 ? "#ffffff" : "var(--bg)" }}>
                    <td className={styles.fornRank}>{String(i + 1).padStart(2, "0")}</td>
                    <td className={styles.fornNameCell}>{f.fornecedor}</td>
                    {allDates.map((d) => {
                      const dia = diaFor(f, d);
                      return (
                        <Fragment key={d}>
                          <td className={styles.fornDayPct}>
                            {dia && dia.percentual > 0 ? `+${dia.percentual.toFixed(1)}%` : "—"}
                          </td>
                          <td className={styles.fornDayValue}>{dia && dia.valor > 0 ? formatCurrency(dia.valor) : "—"}</td>
                          <td className={styles.fornDayDde}>{formatDde(f.dde)}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
