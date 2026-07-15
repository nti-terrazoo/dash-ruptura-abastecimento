import { useState } from "react";
import { useSelectedDate } from "../../hooks/useSelectedDate";
import { BriefingPasswordModal } from "./BriefingPasswordModal";
import { BriefingModal } from "./BriefingModal";
import styles from "./BriefingLauncher.module.css";

//senha do lado do cliente, devido ao fato de ser para uso interno através de IP
const BRIEFING_PASSWORD = "Ak9310";

type BriefingStage = "closed" | "password" | "open";

export function BriefingLauncher() {
  const { selectedDate } = useSelectedDate();
  const [stage, setStage] = useState<BriefingStage>("closed");

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setStage("password")}>
        ⚡ Briefing 9h
      </button>

      {stage === "password" && (
        <BriefingPasswordModal
          isCorrect={(value) => value === BRIEFING_PASSWORD}
          onCancel={() => setStage("closed")}
          onSuccess={() => setStage("open")}
        />
      )}

      {stage === "open" && <BriefingModal date={selectedDate} onClose={() => setStage("closed")} />}
    </>
  );
}
