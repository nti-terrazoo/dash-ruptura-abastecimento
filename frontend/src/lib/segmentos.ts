/** Espelha VALID_SEGMENTOS / SEG_METAS em backend/app/core/business_rules.py.
 * O prefixo "PET" e mantido nos segmentos que realmente o tem - nao remover. */
export const SEGMENTOS = [
  "PET FOOD",
  "PET FARMACIA",
  "JARDINAGEM",
  "AGROPECUARIA",
  "PET HIGIENE E BELEZA",
  "PET ACESSORIOS",
  "PET FAUNA",
  "PET AQUARISMO",
  "LAZER",
] as const;

/** Paleta de identidade dos segmentos - equivalente a GS[]/sc() do dashboard legado. */
const SEGMENT_COLORS = ["#5ed9a0", "#4cbf8a", "#3ca574", "#2e8b5e", "#7ff5b8", "#9aebb2", "#c4e8ce", "#6bb5ff", "#f4a85d"];

export function segmentColor(segmento: string): string {
  const i = SEGMENTOS.indexOf(segmento.toUpperCase() as (typeof SEGMENTOS)[number]);
  return SEGMENT_COLORS[i >= 0 ? i % SEGMENT_COLORS.length : 0];
}
