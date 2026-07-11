/** Espelha VALID_SEGMENTOS / SEG_METAS em backend/app/core/business_rules.py. */
export const SEGMENTOS = [
  "FOOD",
  "FARMACIA",
  "JARDINAGEM",
  "AGROPECUARIA",
  "HIGIENE E BELEZA",
  "ACESSORIOS",
  "FAUNA",
  "AQUARISMO",
  "LAZER",
] as const;

/** Paleta de identidade dos segmentos - equivalente a GS[]/sc() do dashboard legado. */
const SEGMENT_COLORS = ["#5ed9a0", "#4cbf8a", "#3ca574", "#2e8b5e", "#7ff5b8", "#9aebb2", "#c4e8ce", "#6bb5ff", "#f4a85d"];

export function segmentColor(segmento: string): string {
  const clean = segmento.replace(/^PET /, "").toUpperCase();
  const i = SEGMENTOS.indexOf(clean as (typeof SEGMENTOS)[number]);
  return SEGMENT_COLORS[i >= 0 ? i % SEGMENT_COLORS.length : 0];
}
