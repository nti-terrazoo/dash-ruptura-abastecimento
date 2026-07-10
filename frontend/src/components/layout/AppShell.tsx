import { Outlet, useLocation } from "react-router-dom";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";

export function AppShell() {
  const [collapsed] = useSidebarCollapsed();
  const location = useLocation();

  return (
    <>
      <Sidebar />
      <div className={`${styles.content} ${collapsed ? styles.expanded : ""}`}>
        <main className={`${styles.main} page-enter`} key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
