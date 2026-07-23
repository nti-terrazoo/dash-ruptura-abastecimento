import { useCallback, useMemo } from "react";
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
  const rawDates = datesQuery.data?.dates ?? [];

  // Se o usuario escolher (via calendario) uma data fora da janela de 1 mes
  // trazida pelo backend, ela nao aparece em `rawDates` - inserimos aqui na
  // posicao cronologica correta (lista sempre decrescente) para o select
  // continuar refletindo a data selecionada.
  const availableDates = useMemo(() => {
    if (!selectedDate || rawDates.includes(selectedDate)) return rawDates;
    return [...rawDates, selectedDate].sort((a, b) => b.localeCompare(a));
  }, [rawDates, selectedDate]);

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
    availableDates,
    isLoading: datesQuery.isLoading,
  };
}
