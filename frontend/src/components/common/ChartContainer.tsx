import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./ChartContainer.module.css";

interface ChartContainerProps {
  title?: string;
  height?: number;
  children: ReactNode;
}

/**
 * Envolve qualquer grafico Chart.js com o botao "⛶" de tela cheia do
 * dashboard legado. Em vez de clonar a config do Chart.js (como o HTML
 * legado fazia via JSON.parse(JSON.stringify(...))), desmonta o grafico do
 * container pequeno e remonta o mesmo componente React dentro de um portal
 * em tela cheia - mais simples e sem risco de configs divergirem.
 */
export function ChartContainer({ title, height = 260, children }: ChartContainerProps) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className={styles.container} style={{ height }}>
        <button
          type="button"
          className={styles.fsBtn}
          onClick={() => setFullscreen(true)}
          aria-label="Ver em tela cheia"
        >
          ⛶
        </button>
        {!fullscreen && children}
      </div>
      {fullscreen &&
        createPortal(
          <div className={styles.overlay}>
            <button type="button" className={styles.fsClose} onClick={() => setFullscreen(false)}>
              ✕ Fechar
            </button>
            {title && <div className={styles.fsTitle}>{title}</div>}
            <div className={styles.fsChartArea}>{children}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
