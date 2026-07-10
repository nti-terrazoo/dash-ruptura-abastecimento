import styles from "./StatusBadge.module.css";

const STATUS_CONFIG: Record<string, { icon: string; className: keyof typeof styles }> = {
  OK: { icon: "✓", className: "ok" },
  Atenção: { icon: "⚠", className: "atencao" },
  Alerta: { icon: "🔶", className: "alerta" },
  Crítico: { icon: "🔴", className: "critico" },
};

interface StatusBadgeProps {
  status: string;
  onDark?: boolean;
}

export function StatusBadge({ status, onDark = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { icon: "•", className: "ok" as const };
  return (
    <span className={`${styles.badge} ${styles[config.className]} ${onDark ? styles.onDark : ""}`}>
      {config.icon} {status}
    </span>
  );
}
