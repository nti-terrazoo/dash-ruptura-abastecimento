import type { CSSProperties, ReactNode } from "react";
import styles from "./Card.module.css";

interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}

export function Card({ title, actions, children, style }: CardProps) {
  return (
    <div className={styles.card} style={style}>
      {(title || actions) && (
        <div className={styles.title}>
          <span>{title}</span>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
