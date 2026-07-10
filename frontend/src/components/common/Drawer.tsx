import type { ReactNode } from "react";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import styles from "./Drawer.module.css";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const [collapsed] = useSidebarCollapsed();

  return (
    <>
      <div
        className={`${styles.overlay} ${collapsed ? styles.collapsedLeft : ""} ${open ? styles.open : ""}`}
        onClick={onClose}
      />
      <aside className={`${styles.drawer} ${open ? styles.open : ""}`}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
