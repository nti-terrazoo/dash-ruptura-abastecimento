import type { ReactNode } from "react";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import styles from "./Drawer.module.css";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  eyebrow?: ReactNode;
  title: ReactNode;
  children: ReactNode;
}

export function Drawer({ open, onClose, eyebrow, title, children }: DrawerProps) {
  const [collapsed] = useSidebarCollapsed();

  return (
    <>
      <div
        className={`${styles.overlay} ${collapsed ? styles.collapsedLeft : ""} ${open ? styles.open : ""}`}
        onClick={onClose}
      />
      <aside className={`${styles.drawer} ${open ? styles.open : ""}`}>
        <div className={styles.header}>
          <div>
            {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
            <div className={styles.title}>{title}</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </aside>
    </>
  );
}
