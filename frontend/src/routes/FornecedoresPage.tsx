import { useState } from "react";
import { useFornecedores } from "../api/queries";
import type { FornecedorRow } from "../api/types";
import { Card } from "../components/common/Card";
import { ChartContainer } from "../components/common/ChartContainer";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { ErrorState } from "../components/common/ErrorState";
import { FilterPill } from "../components/common/FilterPill";
import { Skeleton } from "../components/common/Skeleton";
import { FornecedorRankingChart } from "../components/charts/FornecedorRankingChart";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { formatCurrency, formatDde, formatPercent } from "../lib/format";
import { SEGMENTOS, segmentColor } from "../lib/segmentos";
import styles from "./FornecedoresPage.module.css";

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function FornecedoresPage() {
  const { selectedDate } = useSelectedDate();
  const [segmento, setSegmento] = useState("TODOS");
  const query = useFornecedores(selectedDate, segmento);

  if (query.isError) return <ErrorState error={query.error} />;
  const data = query.data;
  const top10 = data?.ranking.slice(0, 10) ?? [];
  const segLabel = segmento === "TODOS" ? "Geral" : segmento;

  const columns: DataTableColumn<FornecedorRow>[] = [
    {
      key: "fornecedor",
      header: "Fornecedor",
      render: (r, i) => <span style={{ fontWeight: i < 3 ? 700 : 400, fontSize: 10 }}>{truncate(r.fornecedor, 30)}</span>,
    },
    ...(segmento !== "TODOS"
      ? [
          {
            key: "seg",
            header: "Seg.",
            render: () => <span style={{ fontSize: 9, color: segmentColor(segmento) }}>{segmento}</span>,
          } as DataTableColumn<FornecedorRow>,
        ]
      : []),
    {
      key: "valor",
      header: "R$",
      align: "right",
      render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", color: "#f4a85d" }}>{formatCurrency(r.valor)}</span>,
    },
    {
      key: "pct",
      header: "%",
      align: "right",
      render: (r, i) => (
        <span style={{ fontFamily: "'DM Mono', monospace", color: r.cor, fontWeight: i < 3 ? 700 : 400 }}>
          {formatPercent(r.percentual)}
        </span>
      ),
    },
    {
      key: "dde",
      header: "DDE",
      align: "right",
      render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted)" }}>{formatDde(r.dde)}</span>,
    },
  ];

  return (
    <div>
      <div className={styles.pillsRow}>
        <FilterPill active={segmento === "TODOS"} onClick={() => setSegmento("TODOS")}>
          TODOS
        </FilterPill>
        {SEGMENTOS.map((s) => (
          <FilterPill key={s} active={segmento === s} onClick={() => setSegmento(s)}>
            {s}
          </FilterPill>
        ))}
      </div>

      {!data ? (
        <div className={styles.destaqueGrid}>
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </div>
      ) : (
        <div className={styles.destaqueGrid}>
          {data.destaques.map((f, i) => (
            <div key={f.fornecedor} className={styles.destaqueCard}>
              <div className={styles.destaqueRank}>Maior Ruptura · {i + 1}º</div>
              <div className={styles.destaqueName}>{truncate(f.fornecedor, 32)}</div>
              <div className={styles.destaqueValue}>{formatCurrency(f.valor)}</div>
              <div className={styles.destaqueSub}>
                {formatPercent(f.percentual)} · {segLabel}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        <Card title="Top 10 Fornecedores" actions={<span className={styles.cbPill}>{segLabel}</span>}>
          {!data ? (
            <Skeleton height={320} />
          ) : (
            <ChartContainer height={320} title="Top 10 Fornecedores">
              <FornecedorRankingChart rows={data.ranking} />
            </ChartContainer>
          )}
        </Card>

        <Card title="Ranking + DDE">
          {!data ? (
            <Skeleton height={320} />
          ) : (
            <DataTable columns={columns} rows={top10} keyExtractor={(r) => r.fornecedor} showRank />
          )}
        </Card>
      </div>
    </div>
  );
}
