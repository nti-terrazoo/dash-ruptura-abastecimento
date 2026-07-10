import type { ReactNode } from "react";
import styles from "./FilterPill.module.css";

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  onDark?: boolean;
}

export function FilterPill({ active, onClick, children, onDark = false }: FilterPillProps) {
  return (
    <button
      type="button"
      className={`${styles.pill} ${onDark ? styles.onDark : ""} ${active ? styles.on : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
