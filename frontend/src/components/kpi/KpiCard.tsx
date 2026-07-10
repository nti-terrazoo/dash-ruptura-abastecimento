import type { ReactNode } from "react";
import styles from "./KpiCard.module.css";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  valueColor?: string;
  sub?: ReactNode;
  tag?: { text: string; tone: "good" | "bad" };
  centered?: boolean;
  children?: ReactNode;
}

export function KpiCard({ label, value, valueColor, sub, tag, centered = false, children }: KpiCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${centered ? styles.centered : ""}`} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
      {tag && <div className={`${styles.tag} ${tag.tone === "good" ? styles.tagGood : styles.tagBad}`}>{tag.text}</div>}
      {children && <div className={styles.extra}>{children}</div>}
    </div>
  );
}
