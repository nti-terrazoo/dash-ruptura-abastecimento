import { useEffect, useState, type CSSProperties } from "react";
import { useBridge, useBridgeDrilldown, useLojas } from "../api/queries";
import type { BridgeMode, BridgeStatusItem } from "../api/types";
import { Card } from "../components/common/Card";
import { ChartContainer } from "../components/common/ChartContainer";
import { DataTable } from "../components/common/DataTable";
import { Drawer } from "../components/common/Drawer";
import { ErrorState } from "../components/common/ErrorState";
import { FilterPill } from "../components/common/FilterPill";
import { Skeleton } from "../components/common/Skeleton";
import { BridgeWaterfallChart } from "../components/charts/BridgeWaterfallChart";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { formatCurrency, formatPercent } from "../lib/format";
import { SEGMENTOS } from "../lib/segmentos";
import styles from "./BridgePage.module.css";

const MODES: { value: BridgeMode; label: string }[] = [
  { value: "geral", label: "Geral" },
  { value: "segmento", label: "Por Segmento" },
  { value: "loja", label: "Por Loja" },
];

// Selecionados por padrao ao abrir cada aba, para a tela ja exibir algo em
// vez do skeleton vazio esperando um clique do usuario.
const DEFAULT_SEGMENTO = "ACESSORIOS";
const DEFAULT_LOJA_NOME = "AFRICANOS";

export function BridgePage() {
  const { selectedDate } = useSelectedDate();
  const [mode, setMode] = useState<BridgeMode>("geral");
  const [chave, setChave] = useState<string | null>(null);
  const [drilldownStatus, setDrilldownStatus] = useState<string | null>(null);

  const lojasQuery = useLojas(selectedDate);
  const bridgeQuery = useBridge(selectedDate, mode, chave);
  const drilldownQuery = useBridgeDrilldown(selectedDate, mode, chave, drilldownStatus);

  function changeMode(next: BridgeMode) {
    setMode(next);
    if (next === "segmento") {
      setChave(DEFAULT_SEGMENTO);
    } else if (next === "loja") {
      const africanos = lojasQuery.data?.lojas.find((l) => l.nome === DEFAULT_LOJA_NOME);
      setChave(africanos?.cod_unidade ?? lojasQuery.data?.lojas[0]?.cod_unidade ?? null);
    } else {
      setChave(null);
    }
  }

  // Se o usuario entrar em "Por Loja" antes da lista de lojas carregar, essa
  // troca de aba nao consegue resolver o cod_unidade de AFRICANOS ainda -
  // preenche assim que os dados chegarem.
  useEffect(() => {
    if (mode !== "loja" || chave !== null || !lojasQuery.data) return;
    const africanos = lojasQuery.data.lojas.find((l) => l.nome === DEFAULT_LOJA_NOME);
    setChave(africanos?.cod_unidade ?? lojasQuery.data.lojas[0]?.cod_unidade ?? null);
  }, [mode, chave, lojasQuery.data]);

  if (bridgeQuery.isError) return <ErrorState error={bridgeQuery.error} />;
  const data = bridgeQuery.data;

  return (
    <div>
      <div className={styles.modeRow}>
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            className={`${styles.modeBtn} ${mode === m.value ? styles.active : ""}`}
            onClick={() => changeMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "segmento" && (
        <div className={styles.pillsRow}>
          {SEGMENTOS.map((s) => (
            <FilterPill key={s} active={chave === s} onClick={() => setChave(s)}>
              {s}
            </FilterPill>
          ))}
        </div>
      )}

      {mode === "loja" && (
        <div className={styles.pillsRow}>
          {lojasQuery.data?.lojas.map((l) => (
            <FilterPill key={l.cod_unidade} active={chave === l.cod_unidade} onClick={() => setChave(l.cod_unidade)}>
              {l.nome}
            </FilterPill>
          ))}
        </div>
      )}

      {!data ? (
        <div className="grid-bridge">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={90} />
          ))}
        </div>
      ) : (
        <div className="grid-bridge">
          {data.statuses.map((s) => (
            <div
              key={s.label}
              className={styles.statusCard}
              style={{ "--bc": s.color } as CSSProperties}
              onClick={() => setDrilldownStatus(s.label)}
            >
              <div className={styles.statusLabel}>{s.label}</div>
              <div className={styles.statusValue}>{formatPercent(s.pp, 1)}</div>
              <div className={styles.statusPct}>{formatCurrency(s.valor)}</div>
            </div>
          ))}
        </div>
      )}

      <Card title="Waterfall Meta → Ruptura Atual">
        {!data || (mode !== "geral" && !chave) ? (
          <Skeleton height={300} />
        ) : (
          <ChartContainer height={300} title="Waterfall da Bridge">
            <BridgeWaterfallChart
              metaPercentual={data.meta_percentual ?? 10}
              percentualAtual={data.percentual_atual}
              valorAtual={data.valor_atual}
              statuses={data.statuses}
              onStatusClick={(status: BridgeStatusItem) => setDrilldownStatus(status.label)}
            />
          </ChartContainer>
        )}
      </Card>

      <Drawer
        open={drilldownStatus !== null}
        onClose={() => setDrilldownStatus(null)}
        eyebrow="Bridge — Itens"
        title={drilldownStatus ?? "Itens"}
      >
        <div style={{ padding: "14px 18px" }}>
          {drilldownQuery.isLoading && <Skeleton height={200} />}
          {drilldownQuery.data && (
            <DataTable
              columns={[
                { key: "produto", header: "Produto", render: (r) => r.produto ?? "—" },
                { key: "loja", header: "Loja", render: (r) => r.loja ?? "—" },
                { key: "valor", header: "R$", align: "right", render: (r) => formatCurrency(r.valor) },
              ]}
              rows={drilldownQuery.data.itens}
              keyExtractor={(r, i) => `${r.cod_produto}-${r.cod_unidade}-${i}`}
            />
          )}
        </div>
      </Drawer>
    </div>
  );
}
