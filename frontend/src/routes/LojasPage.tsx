import { useState } from "react";
import { useLojaDetail, useLojas } from "../api/queries";
import type { LojaRow } from "../api/types";
import { Card } from "../components/common/Card";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { Drawer } from "../components/common/Drawer";
import { ErrorState } from "../components/common/ErrorState";
import { Skeleton } from "../components/common/Skeleton";
import { StatusBadge } from "../components/common/StatusBadge";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { formatCurrency, formatDde, formatPercent } from "../lib/format";
import { segmentColor } from "../lib/segmentos";
import styles from "./LojasPage.module.css";

function LojaMiniCard({ loja, tone, onClick }: { loja: LojaRow; tone: "ok" | "crit"; onClick: () => void }) {
  const color = tone === "ok" ? "#5ed9a0" : "#ff6b6b";
  return (
    <div className={`${styles.miniCard} ${tone === "ok" ? styles.miniCardOk : styles.miniCardCrit}`} onClick={onClick}>
      <div className={styles.miniName}>{loja.nome}</div>
      <div className={styles.miniValue} style={{ color }}>
        {formatPercent(loja.percentual, 1)}
      </div>
      <div className={styles.miniSub}>{formatCurrency(loja.valor)}</div>
    </div>
  );
}

export function LojasPage() {
  const { selectedDate } = useSelectedDate();
  const lojasQuery = useLojas(selectedDate);
  const [selectedCod, setSelectedCod] = useState<string | null>(null);
  const [activeSeg, setActiveSeg] = useState<string | null>(null);
  const detailQuery = useLojaDetail(selectedDate, selectedCod);

  if (lojasQuery.isError) return <ErrorState error={lojasQuery.error} />;
  const data = lojasQuery.data;

  function openDrawer(codUnidade: string) {
    setActiveSeg(null);
    setSelectedCod(codUnidade);
  }

  const columns: DataTableColumn<LojaRow>[] = [
    { key: "nome", header: "Loja", render: (r) => <span style={{ fontWeight: 600 }}>{r.nome}</span> },
    {
      key: "pct",
      header: "%",
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: r.cor }}>
          {formatPercent(r.percentual)}
        </span>
      ),
    },
    {
      key: "valor",
      header: "R$",
      align: "right",
      render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", color: "#f4a85d" }}>{formatCurrency(r.valor)}</span>,
    },
    {
      key: "dde",
      header: "DDE",
      align: "right",
      render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", color: "#ffd166" }}>{formatDde(r.dde)}</span>,
    },
    { key: "status", header: "Status", align: "right", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <div className="grid-2">
        <Card
          title={<span style={{ color: "#5ed9a0" }}>✓ Lojas Dentro da Meta</span>}
          actions={<span className={styles.countPillOk}>{data ? `${data.dentro_meta.length} lojas` : "—"}</span>}
          style={{ borderTop: "3px solid #5ed9a0" }}
        >
          {!data ? (
            <Skeleton height={100} />
          ) : data.dentro_meta.length === 0 ? (
            <div className={styles.emptyMsg}>Nenhuma loja dentro da meta hoje</div>
          ) : (
            <div className={styles.miniGrid}>
              {[...data.dentro_meta]
                .sort((a, b) => a.percentual - b.percentual)
                .map((loja) => (
                  <LojaMiniCard key={loja.cod_unidade} loja={loja} tone="ok" onClick={() => openDrawer(loja.cod_unidade)} />
                ))}
            </div>
          )}
        </Card>
        <Card
          title={<span style={{ color: "#ff6b6b" }}>🔴 Acima da Meta</span>}
          actions={<span className={styles.countPillCrit}>{data ? `${data.acima_meta.length} lojas` : "—"}</span>}
          style={{ borderTop: "3px solid #ff6b6b" }}
        >
          {!data ? (
            <Skeleton height={100} />
          ) : data.acima_meta.length === 0 ? (
            <div className={styles.emptyMsg}>Nenhuma loja acima da meta</div>
          ) : (
            <div className={styles.miniGrid}>
              {data.acima_meta.map((loja) => (
                <LojaMiniCard key={loja.cod_unidade} loja={loja} tone="crit" onClick={() => openDrawer(loja.cod_unidade)} />
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
            onRowClick={(r) => openDrawer(r.cod_unidade)}
            showRank
          />
        )}
      </Card>

      <Drawer
        open={selectedCod !== null}
        onClose={() => setSelectedCod(null)}
        eyebrow="Detalhe da Loja"
        title={detailQuery.data?.nome ?? "Loja"}
      >
        {detailQuery.isLoading && (
          <div style={{ padding: "14px 18px" }}>
            <Skeleton height={200} />
          </div>
        )}
        {detailQuery.data &&
          (() => {
            const detail = detailQuery.data;
            const maxOfensor = detail.segmentos_ofensores[0]?.valor || 1;
            const filteredItens = activeSeg
              ? detail.top_itens.filter((it) => it.segmento === activeSeg)
              : detail.top_itens;

            return (
              <>
                <div className={styles.drawerKpis}>
                  <div>
                    <div className={styles.drawerKpiLabel}>% Ruptura</div>
                    <div className={styles.drawerKpiValue} style={{ color: detail.percentual <= 10 ? "#2d6b4a" : "#e05555" }}>
                      {formatPercent(detail.percentual, 1)}
                    </div>
                  </div>
                  <div>
                    <div className={styles.drawerKpiLabel}>Valor</div>
                    <div className={styles.drawerKpiValue} style={{ color: "#f4a85d" }}>
                      {formatCurrency(detail.valor)}
                    </div>
                  </div>
                  <div>
                    <div className={styles.drawerKpiLabel}>DDE</div>
                    <div className={styles.drawerKpiValue} style={{ color: "#ffd166" }}>
                      {formatDde(detail.dde)}
                    </div>
                  </div>
                </div>

                <div className={styles.drawerSection}>
                  <div className={styles.segSectionHeader}>
                    <div className="section-title" style={{ marginBottom: 0 }}>
                      Segmentos Ofensores
                    </div>
                    {activeSeg && (
                      <button type="button" className={styles.segResetBtn} onClick={() => setActiveSeg(null)}>
                        ← Todos
                      </button>
                    )}
                  </div>
                  {detail.segmentos_ofensores.length === 0 ? (
                    <div className={styles.emptyMsg}>Sem dados de segmento</div>
                  ) : (
                    detail.segmentos_ofensores.map((s) => {
                      const color = segmentColor(s.segmento);
                      const isActive = activeSeg === s.segmento;
                      const dimmed = activeSeg !== null && !isActive;
                      return (
                        <div
                          key={s.segmento}
                          className={styles.offensorRow}
                          style={{
                            background: isActive ? "rgba(45,107,74,.2)" : "rgba(255,255,255,.04)",
                            opacity: dimmed ? 0.45 : 1,
                          }}
                          onClick={() => setActiveSeg(isActive ? null : s.segmento)}
                        >
                          <span className={styles.offensorLabel} style={{ color }}>
                            {s.segmento}
                          </span>
                          <div className={styles.offensorBarWrap}>
                            <div className={styles.offensorBarTrack}>
                              <div
                                className={styles.offensorBarFill}
                                style={{ width: `${maxOfensor > 0 ? (s.valor / maxOfensor) * 100 : 0}%`, background: color }}
                              />
                            </div>
                            <span className={styles.offensorValue}>{formatCurrency(s.valor)}</span>
                            <span className={styles.offensorChevron}>›</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={styles.drawerSectionLast}>
                  <div className="section-title">{activeSeg ? `Top 10 — ${activeSeg}` : "Top 10 Itens"}</div>
                  <div className={styles.itemsList}>
                    {filteredItens.length === 0 ? (
                      <div className={styles.emptyMsg} style={{ padding: 12 }}>
                        Nenhum item encontrado
                      </div>
                    ) : (
                      filteredItens.slice(0, 10).map((it, i) => (
                        <div key={`${it.cod_produto}-${i}`} className={styles.itemRow}>
                          <span className={styles.itemRank}>{String(i + 1).padStart(2, "0")}</span>
                          <div className={styles.itemInfo}>
                            <div className={styles.itemName}>{it.produto ?? "—"}</div>
                            <div className={styles.itemSeg}>{it.segmento ?? "—"}</div>
                          </div>
                          <span className={styles.itemValue}>{formatCurrency(it.valor)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            );
          })()}
      </Drawer>
    </div>
  );
}
