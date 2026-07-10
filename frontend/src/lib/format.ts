/** Formatacao de exibicao - equivalente as funcoes fv()/fmt()/fmtISO() do
 * dashboard legado. O backend sempre entrega numeros crus e datas ISO. */

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `R$ ${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `R$ ${(value / 1e3).toFixed(1)}K`;
  return `R$ ${value.toFixed(0)}`;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDde(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}d`;
}

/** Converte "YYYY-MM-DD" para "DD/MM" sem instanciar Date (evita bug de
 * timezone do dashboard legado, onde `new Date('YYYY-MM-DD')` e interpretado
 * como UTC e pode exibir o dia errado dependendo do fuso do navegador). */
export function formatDateShort(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export function formatDateFull(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
