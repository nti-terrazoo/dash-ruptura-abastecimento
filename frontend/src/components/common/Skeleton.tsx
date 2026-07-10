import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, style }: SkeletonProps) {
  return <div className={styles.block} style={{ width, height, ...style }} />;
}

export function KpiCardSkeleton() {
  return (
    <div style={{ background: "var(--g1)", borderRadius: 13, padding: "17px 20px" }}>
      <Skeleton width={70} height={10} style={{ marginBottom: 10, opacity: 0.3 }} />
      <Skeleton width={90} height={26} style={{ opacity: 0.3 }} />
    </div>
  );
}
