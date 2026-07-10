import { useState } from "react";
import { useLojaDetail, useLojas } from "../api/queries";
import type { LojaRow } from "../api/types";
import { Card } from "../components/common/Card";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { Drawer } from "../components/common/Drawer";
import { ErrorState } from "../components/common/ErrorState";
import { ProgressBar } from "../components/common/ProgressBar";
import { Skeleton } from "../components/common/Skeleton";
import { StatusBadge } from "../components/common/StatusBadge";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { formatCurrency, formatDde, formatPercent } from "../lib/format";
import styles from "./LojasPage.module.css";

function LojaMiniCard({ loja, onClick }: { loja: LojaRow; onClick: () => void }) {
  return (
    <div className={styles.miniCard} onClick={onClick}>
      <div className={styles.miniName}>{loja.nome}</div>
      <div className={styles.miniValue}>
        {formatPercent(loja.percentual)} · {formatCurrency(loja.valor)}
      </div>
      <ProgressBar percent={loja.percentual} color={loja.cor} />
    </div>
  );
}

export function LojasPage() {
  const { selectedDate } = useSelectedDate();
  const lojasQuery = useLojas(selectedDate);
  const [selectedCod, setSelectedCod] = useState<string | null>(null);
  const detailQuery = useLojaDetail(selectedDate, selectedCod);

  if (lojasQuery.isError) return <ErrorState error={lojasQuery.error} />;
  const data = lojasQuery.data;

  const columns: DataTableColumn<LojaRow>[] = [
    { key: "nome", header: "Loja", render: (r) => r.nome },
    { key: "pct", header: "%", align: "right", render: (r) => formatPercent(r.percentual) },
    { key: "valor", header: "R$", align: "right", render: (r) => formatCurrency(r.valor) },
    { key: "dde", header: "DDE", align: "right", render: (r) => formatDde(r.dde) },
    { key: "status", header: "Status", align: "right", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <div className="grid-2">
        <Card title="✓ Lojas Dentro da Meta">
          {!data ? (
            <Skeleton height={100} />
          ) : (
            <div className={styles.miniGrid}>
              {data.dentro_meta.map((loja) => (
                <LojaMiniCard key={loja.cod_unidade} loja={loja} onClick={() => setSelectedCod(loja.cod_unidade)} />
              ))}
            </div>
          )}
        </Card>
        <Card title="🔴 Acima da Meta">
          {!data ? (
            <Skeleton height={100} />
          ) : (
            <div className={styles.miniGrid}>
              {data.acima_meta.map((loja) => (
                <LojaMiniCard key={loja.cod_unidade} loja={loja} onClick={() => setSelectedCod(loja.cod_unidade)} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Todas as Lojas">
        {!data ? (
          <Skeleton height={300} />
        ) : (
          <DataTable
            columns={columns}
            rows={data.lojas}
            keyExtractor={(r) => r.cod_unidade}
            onRowClick={(r) => setSelectedCod(r.cod_unidade)}
            showRank
          />
        )}
      </Card>

      <Drawer open={selectedCod !== null} onClose={() => setSelectedCod(null)} title={detailQuery.data?.nome ?? "Loja"}>
        {detailQuery.isLoading && <Skeleton height={200} />}
        {detailQuery.data &&
          (() => {
            const detail = detailQuery.data;
            const maxOfensor = detail.segmentos_ofensores[0]?.valor || 1;
            return (
              <>
                <div className={styles.drawerKpis}>
                  <div className={styles.drawerKpi}>
                    <div className={styles.drawerKpiLabel}>% Ruptura</div>
                    <div className={styles.drawerKpiValue}>{formatPercent(detail.percentual)}</div>
                  </div>
                  <div className={styles.drawerKpi}>
                    <div className={styles.drawerKpiLabel}>Valor</div>
                    <div className={styles.drawerKpiValue}>{formatCurrency(detail.valor)}</div>
                  </div>
                  <div className={styles.drawerKpi}>
                    <div className={styles.drawerKpiLabel}>DDE</div>
                    <div className={styles.drawerKpiValue}>{formatDde(detail.dde)}</div>
                  </div>
                  <div className={styles.drawerKpi}>
                    <div className={styles.drawerKpiLabel}>Status</div>
                    <div className={styles.drawerKpiValue}>
                      <StatusBadge status={detail.status} />
                    </div>
                  </div>
                </div>

                <div className="section-title">Segmentos Ofensores</div>
                {detail.segmentos_ofensores.map((s, i) => (
                  <div key={s.segmento} className={styles.offensorRow}>
                    <span className={styles.offensorLabel}>{s.segmento}</span>
                    <div style={{ flex: 1 }}>
                      <ProgressBar
                        percent={(s.valor / maxOfensor) * 100}
                        color={i === 0 ? "var(--red)" : "var(--g1)"}
                      />
                    </div>
                    <span className={styles.offensorValue}>{formatCurrency(s.valor)}</span>
                  </div>
                ))}

                <div className={`section-title ${styles.sectionGap}`}>Top 10 Itens</div>
                <DataTable
                  columns={[
                    { key: "produto", header: "Produto", render: (r) => r.produto ?? "—" },
                    { key: "valor", header: "R$", align: "right", render: (r) => formatCurrency(r.valor) },
                  ]}
                  rows={detail.top_itens}
                  keyExtractor={(r, i) => `${r.cod_produto}-${i}`}
                />
              </>
            );
          })()}
      </Drawer>
    </div>
  );
}
