import { ApiError } from "../../api/client";
import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  error: unknown;
}

export function ErrorState({ error }: ErrorStateProps) {
  const message =
    error instanceof ApiError
      ? error.status === 503
        ? "O backend não conseguiu falar com o Oracle agora. Tente novamente em instantes."
        : error.message
      : "Não foi possível carregar os dados.";

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>Ops, algo deu errado</div>
      <div className={styles.detail}>{message}</div>
    </div>
  );
}
