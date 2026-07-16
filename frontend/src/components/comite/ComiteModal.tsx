import { useMemo, useState } from "react";
import { useComite } from "../../api/queries";
import { ErrorState } from "../common/ErrorState";
import { Skeleton } from "../common/Skeleton";
import { formatDateFull } from "../../lib/format";
import { buildPreviewSlides } from "./comitePreview";
import { gerarComitePptx } from "./comitePptx";
import styles from "./ComiteModal.module.css";

interface ComiteModalProps {
  date: string | undefined;
  onClose: () => void;
}

type Stage = "start" | "preview";

export function ComiteModal({ date, onClose }: ComiteModalProps) {
  const query = useComite(date, true);
  const [stage, setStage] = useState<Stage>("start");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const data = query.data;
  const slides = useMemo(() => (data ? buildPreviewSlides(data) : []), [data]);

  async function handleBaixar() {
    if (!data) return;
    setGerando(true);
    setErro(null);
    try {
      await gerarComitePptx(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar o PPTX.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.headerTitle}>📊 Apresentação Comitê de Abastecimento</div>
            <div className={styles.headerSub}>
              {data ? `Referência: ${formatDateFull(data.data_referencia)}` : "Carregando…"}
            </div>
          </div>
          <div className={styles.headerActions}>
            {stage === "preview" && data && (
              <button type="button" className={styles.downloadBtn} onClick={handleBaixar} disabled={gerando}>
                {gerando ? "Gerando…" : "⬇ Baixar PPTX"}
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {query.isError ? (
            <ErrorState error={query.error} />
          ) : query.isLoading || !data ? (
            <>
              <Skeleton height={60} style={{ marginBottom: 16 }} />
              <Skeleton height={200} />
            </>
          ) : stage === "start" ? (
            <div className={styles.startBox}>
              <div className={styles.startIcon}>📊</div>
              <div className={styles.startTitle}>Gerar Apresentação</div>
              <div className={styles.startInfo}>
                Data de referência: {formatDateFull(data.data_referencia)} · {data.lojas.length} lojas ·{" "}
                {data.segmentos.length} segmentos
              </div>
              {!data.curvas.disponivel && (
                <div className={styles.warnBox}>
                  ⚠ Dados de curva ABC não disponíveis para este período — as slides de curva ABC não serão
                  incluídas no PPTX.
                </div>
              )}
              <button type="button" className={styles.startBtn} onClick={() => setStage("preview")}>
                Pré-visualizar Apresentação
              </button>
            </div>
          ) : (
            <>
              <div className={styles.previewHint}>
                {slides.length} slides prontos. Confira o resumo abaixo e clique em "Baixar PPTX" para gerar o
                arquivo.
              </div>
              {erro && <div className={styles.errBox}>{erro}</div>}
              <div className={styles.grid}>
                {slides.map((s, i) => (
                  <div key={i} className={styles.slideCard}>
                    <div className={styles.slideHeader}>
                      <span className={styles.slideIndex}>{i + 1}</span>
                      <span className={styles.slideTitle}>{s.titulo}</span>
                    </div>
                    <div className={styles.slideBody}>
                      {s.linhas.map((l, li) => (
                        <div key={li} className={styles.slideLinha}>
                          <span className={styles.slideLabel}>{l.label}</span>
                          <span className={styles.slideValue} style={l.color ? { color: l.color } : undefined}>
                            {l.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
