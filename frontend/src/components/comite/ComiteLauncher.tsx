import { useState } from "react";
import { useSelectedDate } from "../../hooks/useSelectedDate";
import { ComiteModal } from "./ComiteModal";
import styles from "./ComiteLauncher.module.css";

export function ComiteLauncher() {
  const { selectedDate } = useSelectedDate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        📊 Apresentação Comitê
      </button>

      {open && <ComiteModal date={selectedDate} onClose={() => setOpen(false)} />}
    </>
  );
}
