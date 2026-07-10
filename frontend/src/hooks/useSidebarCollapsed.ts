import { useSyncExternalStore } from "react";

const STORAGE_KEY = "ruptura-sidebar-collapsed";

/** Store externo minimo (nao e um Context nem uma lib de estado) - varios
 * componentes (Sidebar, AppShell, Drawer overlay) precisam ler/escrever o
 * mesmo estado de colapso, e useState local por componente ficaria
 * dessincronizado entre eles. */
let collapsed = localStorage.getItem(STORAGE_KEY) === "1";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return collapsed;
}

function setCollapsedValue(next: boolean | ((prev: boolean) => boolean)) {
  const resolved = typeof next === "function" ? next(collapsed) : next;
  collapsed = resolved;
  localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  listeners.forEach((listener) => listener());
}

export function useSidebarCollapsed() {
  const value = useSyncExternalStore(subscribe, getSnapshot);
  return [value, setCollapsedValue] as const;
}
