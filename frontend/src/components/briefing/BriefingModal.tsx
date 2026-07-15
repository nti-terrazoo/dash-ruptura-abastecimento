import { useBriefing } from "../../api/queries";
import { ErrorState } from "../common/ErrorState";
import { Skeleton } from "../common/Skeleton";
import { formatCurrency, formatDateFull, formatDde, formatPercent } from "../../lib/format";
import { buildPautaTexto, buildResumo } from "./briefingText";
import styles from "./BriefingModal.module.css";
import type { CSSProperties } from "react";

interface BriefingModalProps {
  date: string | undefined;
  onClose: () => void;
}

export function BriefingModal({ date, onClose }: BriefingModalProps) {
  const query = useBriefing(date, true);
  const data = query.data;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>⚡ Briefing das 9h</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {query.isError ? (
            <ErrorState error={query.error} />
          ) : query.isLoading || !data ? (
            <>
              <Skeleton height={60} style={{ marginBottom: 16 }} />
              <Skeleton height={100} style={{ marginBottom: 16 }} />
              <Skeleton height={160} />
            </>
          ) : (
            <>
              <div className={styles.topRow}>
                <div>
                  <div className={styles.kicker}>TerraZoo · Inteligência Comercial</div>
                  <div className={styles.dateTitle}>Briefing · {formatDateFull(data.data_referencia)}</div>
                </div>
                <span className={`${styles.metaPill} ${data.acima_meta_geral ? styles.metaPillCrit : styles.metaPillOk}`}>
                  Ruptura {formatPercent(data.ruptura_percentual)} · {data.acima_meta_geral ? "Acima da meta" : "Dentro da meta"}
                </span>
              </div>

              <div className={`${styles.resumo} ${data.acima_meta_geral ? "" : styles.resumoOk}`}>{buildResumo(data)}</div>

              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>Ruptura</div>
                  <div className={styles.kpiValue}>{formatPercent(data.ruptura_percentual)}</div>
                </div>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>Valor em Ruptura</div>
                  <div className={styles.kpiValue}>{formatCurrency(data.ruptura_valor)}</div>
                </div>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>s/ Pedido</div>
                  <div className={styles.kpiValue}>{formatCurrency(data.sem_pedido_valor)}</div>
                </div>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>DDE Geral</div>
                  <div className={styles.kpiValue}>{formatDde(data.dde_geral)}</div>
                </div>
              </div>

              <div className={styles.twoCol}>
                <div className={styles.panel}>
                  <div className={styles.panelTitle}>⚠️ Lojas Críticas (&gt;15%)</div>
                  {data.lojas_criticas.length === 0 ? (
                    <div className={styles.emptyState}>Nenhuma loja acima de 15%.</div>
                  ) : (
                    data.lojas_criticas.map((loja) => (
                      <div key={loja.cod_unidade} className={styles.listRow}>
                        <span className={styles.listRowName}>{loja.nome}</span>
                        <span className={styles.listRowValue}>{formatPercent(loja.percentual, 1)}</span>
                      </div>
                    ))
                  )}
                  {data.melhor_loja && (
                    <div className={styles.bestLojaCard}>
                      ✓ {data.melhor_loja.nome} · {formatPercent(data.melhor_loja.percentual, 1)} — melhor loja do dia
                    </div>
                  )}
                </div>

                <div className={styles.panel}>
                  <div className={styles.panelTitle}>🔴 Itens s/ Pedido (Top 3)</div>
                  {data.itens_sem_pedido.length === 0 ? (
                    <div className={styles.emptyState}>Nenhum item crítico s/ pedido.</div>
                  ) : (
                    data.itens_sem_pedido.map((item, i) => (
                      <div key={i} className={styles.listRow}>
                        <span>
                          <span className={styles.listRowName}>{item.produto ?? "—"}</span>
                          <div className={styles.listRowSub}>{item.loja ?? "—"}</div>
                        </span>
                        <span className={styles.listRowValue}>{formatCurrency(item.valor)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.panel}>
                <div className={styles.panelTitle}>📋 Sugestões de Pauta para Reunião</div>
                {data.pautas.length === 0 ? (
                  <div className={styles.emptyState}>Sem alertas críticos hoje.</div>
                ) : (
                  <div className={styles.pautaList}>
                    {data.pautas.map((pauta, i) => (
                      <div
                        key={i}
                        className={styles.pautaItem}
                        style={{ "--pauta-color": pauta.cor } as CSSProperties}
                      >
                        <span className={styles.pautaIndex}>{i + 1}.</span>
                        <span className={styles.pautaText}>{buildPautaTexto(pauta)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
