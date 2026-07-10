import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useDates } from "../api/queries";

/**
 * Data de referencia global do dashboard, guardada em `?date=` na URL (para
 * ser compartilhavel/sobreviver a reload) com fallback para a data mais
 * recente disponivel (`/api/dates`), igual ao comportamento do dashboard
 * legado (que escolhia a ultima data disponivel por padrao).
 */
export function useSelectedDate() {
  const [searchParams, setSearchParams] = useSearchParams();
  const datesQuery = useDates();

  const dateParam = searchParams.get("date");
  const selectedDate = dateParam ?? datesQuery.data?.default ?? undefined;

  const setSelectedDate = useCallback(
    (date: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("date", date);
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  return {
    selectedDate,
    setSelectedDate,
    availableDates: datesQuery.data?.dates ?? [],
    isLoading: datesQuery.isLoading,
  };
}
