import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  /** 0-100, ja resolvido pelo chamador (percentual absoluto ou relativo ao maior item do grupo). */
  percent: number;
  color: string;
  onDark?: boolean;
}

export function ProgressBar({ percent, color, onDark = false }: ProgressBarProps) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className={`${styles.track} ${onDark ? styles.trackOnDark : ""}`}>
      <div className={styles.fill} style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

interface LabeledProgressBarProps extends ProgressBarProps {
  label: string;
  valueLabel: string;
}

export function LabeledProgressBar({ label, valueLabel, ...barProps }: LabeledProgressBarProps) {
  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{valueLabel}</span>
      </div>
      <div style={{ marginTop: 4 }}>
        <ProgressBar {...barProps} />
      </div>
    </div>
  );
}
