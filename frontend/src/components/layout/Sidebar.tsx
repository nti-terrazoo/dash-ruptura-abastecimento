import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import logo from "../../assets/logo.webp";
import { useSelectedDate } from "../../hooks/useSelectedDate";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { formatDateFull } from "../../lib/format";
import {
  BridgeIcon,
  ChevronIcon,
  FornecedoresIcon,
  LojasIcon,
  OverviewIcon,
  RefreshIcon,
  SegmentosIcon,
} from "./icons";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { to: "/", label: "Visão Geral", icon: OverviewIcon, end: true },
  { to: "/lojas", label: "Lojas", icon: LojasIcon, end: false },
  { to: "/fornecedores", label: "Fornecedores", icon: FornecedoresIcon, end: false },
  { to: "/bridge", label: "Bridge / CD", icon: BridgeIcon, end: false },
  { to: "/segmentos", label: "Rupt. Segmentos", icon: SegmentosIcon, end: false },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const { selectedDate, setSelectedDate, availableDates } = useSelectedDate();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // Preserva ?date= (e qualquer outro query param) ao trocar de aba - sem
  // isso, NavLink navega para o path puro e a data selecionada se perde.
  const location = useLocation();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      window.setTimeout(() => setRefreshing(false), 400);
    }
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.brand}>
        <img src={logo} alt="TerraZoo" className={styles.logo} />
        <span className={styles.collapsedMark}>🌿</span>
        <div className={styles.sub}>Inteligência Comercial</div>
      </div>

      <div className={styles.divider} />

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={{ pathname: to, search: location.search }}
            end={end}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.on : ""}`}
            title={label}
          >
            <Icon className={styles.tabIcon} />
            <span className={styles.tabLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.dividerBottom} />

      <div className={styles.controls}>
        <select
          className={styles.datePicker}
          value={selectedDate ?? ""}
          onChange={(event) => setSelectedDate(event.target.value)}
        >
          {availableDates.map((date) => (
            <option key={date} value={date}>
              {formatDateFull(date)}
            </option>
          ))}
        </select>

        <div className={styles.tsPill}>
          <span className={styles.liveDot} />
          Atualizado: <strong>{selectedDate ? formatDateFull(selectedDate) : "—"}</strong>
        </div>

        <button
          type="button"
          className={`${styles.refreshBtn} ${refreshing ? styles.loading : ""}`}
          onClick={handleRefresh}
        >
          <RefreshIcon />
          Atualizar
        </button>
      </div>

      <div className={styles.footer}>Criado por Abner Santos</div>

      <button
        type="button"
        className={`${styles.toggle} ${collapsed ? styles.flipped : ""}`}
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        <ChevronIcon />
      </button>
    </aside>
  );
}
