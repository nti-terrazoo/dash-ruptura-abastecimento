import { useEffect, useRef, useState } from "react";
import styles from "./BriefingPasswordModal.module.css";

interface BriefingPasswordModalProps {
  onCancel: () => void;
  onSuccess: () => void;
  isCorrect: (value: string) => boolean;
}

/** Gate por senha do Briefing 9h - so uma barreira de UI (a senha viaja no
 * bundle do frontend, igual ao dashboard legado), nao autenticacao real.
 * Ver BriefingLauncher.tsx para a decisao de manter esse comportamento. */
export function BriefingPasswordModal({ onCancel, onSuccess, isCorrect }: BriefingPasswordModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") submit();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function submit() {
    if (isCorrect(value)) {
      onSuccess();
    } else {
      setError(true);
      setValue("");
      inputRef.current?.focus();
    }
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.card} onClick={(event) => event.stopPropagation()}>
        <div className={styles.icon}>🔐</div>
        <div className={styles.title}>Briefing 9h</div>
        <div className={styles.subtitle}>Acesso restrito · Digite a senha</div>
        <input
          ref={inputRef}
          type="password"
          placeholder="Senha"
          className={styles.input}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(false);
          }}
        />
        {error && <div className={styles.error}>Senha incorreta. Tente novamente.</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.confirmBtn} onClick={submit}>
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
