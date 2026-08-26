import { NavLink, useLocation } from "react-router-dom";
import { CriteriosIcon } from "./icons";
import styles from "./CriteriosFab.module.css";

/** Botao flutuante fixo (inferior direito), presente em todas as telas -
 * unico ponto de acesso aos Criterios de Classificacao (antes era um item
 * na Sidebar). Fica oculto na propria pagina /criterios para nao virar um
 * link para si mesma. */
export function CriteriosFab() {
  const location = useLocation();
  if (location.pathname === "/criterios") return null;

  return (
    <NavLink
      to={{ pathname: "/criterios", search: location.search }}
      className={styles.fab}
      title="Critérios de Classificação"
      aria-label="Ver critérios de classificação de Ruptura e DDE"
    >
      <CriteriosIcon className={styles.icon} />
    </NavLink>
  );
}
