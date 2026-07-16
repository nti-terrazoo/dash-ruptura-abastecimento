import { useState } from "react";
import { useSelectedDate } from "../../hooks/useSelectedDate";
import { BriefingModal } from "./BriefingModal";
import styles from "./BriefingLauncher.module.css";

type BriefingStage = "closed" | "open";

export function BriefingLauncher() {
  const { selectedDate } = useSelectedDate();
  const [stage, setStage] = useState<BriefingStage>("closed");

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setStage("open")}>
        ⚡ Briefing 9h
      </button>

      {stage === "open" && <BriefingModal date={selectedDate} onClose={() => setStage("closed")} />}
    </>
  );
}
