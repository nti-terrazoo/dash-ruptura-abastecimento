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
import { SEGMENTOS } from "../lib/segmentos";
import styles from "./FornecedoresPage.module.css";

export function FornecedoresPage() {
  const { selectedDate } = useSelectedDate();
  const [segmento, setSegmento] = useState("TODOS");
  const query = useFornecedores(selectedDate, segmento);

  if (query.isError) return <ErrorState error={query.error} />;
  const data = query.data;

  const columns: DataTableColumn<FornecedorRow>[] = [
    { key: "fornecedor", header: "Fornecedor", render: (r) => r.fornecedor },
    { key: "pct", header: "%", align: "right", render: (r) => <span style={{ color: r.cor }}>{formatPercent(r.percentual)}</span> },
    { key: "valor", header: "R$", align: "right", render: (r) => formatCurrency(r.valor) },
    { key: "dde", header: "DDE", align: "right", render: (r) => formatDde(r.dde) },
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
          <Skeleton height={80} />
          <Skeleton height={80} />
          <Skeleton height={80} />
        </div>
      ) : (
        <div className={styles.destaqueGrid}>
          {data.destaques.map((f, i) => (
            <div key={f.fornecedor} className={styles.destaqueCard}>
              <div className={styles.destaqueRank}>Maior Ruptura · {i + 1}º</div>
              <div className={styles.destaqueName}>{f.fornecedor}</div>
              <div className={styles.destaqueValue}>
                {formatPercent(f.percentual)} · {formatCurrency(f.valor)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card title="Top 10 Fornecedores">
        {!data ? (
          <Skeleton height={280} />
        ) : (
          <ChartContainer height={280} title="Top 10 Fornecedores">
            <FornecedorRankingChart rows={data.ranking} />
          </ChartContainer>
        )}
      </Card>

      <Card title="Ranking Completo">
        {!data ? (
          <Skeleton height={300} />
        ) : (
          <DataTable columns={columns} rows={data.ranking} keyExtractor={(r) => r.fornecedor} showRank />
        )}
      </Card>
    </div>
  );
}
