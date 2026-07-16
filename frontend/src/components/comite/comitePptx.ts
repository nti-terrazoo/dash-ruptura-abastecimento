/**
 * Geracao real do PPTX da Apresentacao Comite (gerarPPTX()), adaptado para consumir o
 * payload agregado de /api/comite (ComiteResponse). Mesma paleta/layout/regras de negocio;
 * a diferenca principal e que meta/DDE-meta/cor/bridge por segmento ja vem
 * prontos do backend (nao recalculados aqui).
 */
import PptxGenJS from "pptxgenjs";
import type { ComiteCurvaPonto, ComiteResponse, ComiteSegmento } from "../../api/types";
import { formatDateFull } from "../../lib/format";

const CV = {
  verde: "2d6b4a",
  verdeEsc: "1a2e22",
  verdeMed: "3a8a5c",
  verdeClr: "7dd4a0",
  bg: "f0f4f0",
  bgCard: "ffffff",
  branco: "ffffff",
  texto: "1a2e22",
  muted: "5a7a6a",
  vermelho: "e05555",
  amarelo: "c87010",
  amareloCl: "ffd166",
  azul: "3a7fd5",
};

const CURVAS = ["A", "B", "C", "D"] as const;
const COR_CURVA: Record<string, string> = { A: "1565C0", B: "2E7D32", C: "E65100", D: "AD1457" };

function fv(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`;
  return `R$ ${v.toFixed(0)}`;
}

function shadow(): PptxGenJS.ShadowProps {
  return { type: "outer", color: "000000", blur: 6, offset: 2, angle: 45, opacity: 0.1 };
}

/** addChart multi-tipo (combo linha+barra) usa uma assinatura de 2 args no
 * pptxgenjs real (type=array de {type,data,options}, 2o arg=options
 * compartilhado) que diverge da tipagem declarada (3 args) - wrapper
 * isolado para nao espalhar o cast pelo arquivo todo. */
function addComboChart(sl: PptxGenJS.Slide, series: PptxGenJS.IChartMulti[], options: PptxGenJS.IChartOpts) {
  const fn = sl.addChart as unknown as (type: PptxGenJS.IChartMulti[], options: PptxGenJS.IChartOpts) => PptxGenJS.Slide;
  fn.call(sl, series, options);
}

function hdr(sl: PptxGenJS.Slide, titulo: string, sub = "") {
  sl.addShape("rect", { x: 0, y: 0, w: 13.3, h: 0.7, fill: { color: CV.verde }, line: { color: CV.verde } });
  sl.addText(titulo, {
    x: 0.3, y: 0, w: 9.5, h: 0.7, fontSize: 17, bold: true, color: CV.branco, fontFace: "Calibri",
    valign: "middle", margin: 0,
  });
  if (sub) {
    sl.addText(sub, {
      x: 9.8, y: 0, w: 3.2, h: 0.7, fontSize: 10, color: "b0d4b8", fontFace: "Calibri",
      valign: "middle", align: "right", margin: 0,
    });
  }
}

function ftr(sl: PptxGenJS.Slide, dataFmt: string) {
  sl.addShape("rect", { x: 0, y: 7.2, w: 13.3, h: 0.3, fill: { color: CV.verdeEsc }, line: { color: CV.verdeEsc } });
  sl.addText(`TerraZoo — Inteligência Comercial  |  ${dataFmt}  |  Comitê de Abastecimento`, {
    x: 0.3, y: 7.2, w: 12.7, h: 0.3, fontSize: 8, color: "7dd4a0", fontFace: "Calibri", valign: "middle", margin: 0,
  });
}

function kpi(
  sl: PptxGenJS.Slide, x: number, y: number, w: number, h: number,
  label: string, valor: string, sub = "", cor = "7dd4a0",
) {
  sl.addShape("roundRect", { x, y, w, h, fill: { color: CV.verde }, line: { color: CV.verde }, rectRadius: 0.09, shadow: shadow() });
  sl.addText(label.toUpperCase(), {
    x: x + 0.13, y: y + 0.1, w: w - 0.26, h: 0.22, fontSize: 7.5, color: "b0d4b8", bold: true,
    fontFace: "Calibri", charSpacing: 1, margin: 0,
  });
  sl.addText(valor, {
    x: x + 0.12, y: y + 0.3, w: w - 0.24, h: 0.55, fontSize: 20, bold: true, color: cor, fontFace: "Calibri", margin: 0,
  });
  if (sub) {
    sl.addText(sub, { x: x + 0.12, y: y + 0.85, w: w - 0.24, h: 0.2, fontSize: 8.5, color: "b0d4b8", fontFace: "Calibri", margin: 0 });
  }
}

function tableHeaderRow(labels: { text: string; align?: "left" | "center" | "right" }[]): PptxGenJS.TableRow {
  return labels.map((l) => ({
    text: l.text,
    options: { bold: true, color: CV.branco, fill: { color: CV.verde }, align: l.align ?? "left" },
  }));
}

function tableRow(
  cells: { text: string; align?: "left" | "center" | "right"; color?: string; bold?: boolean }[],
  i: number,
): PptxGenJS.TableRow {
  const bg = i % 2 ? "f7fbf7" : CV.bgCard;
  return cells.map((c) => ({
    text: c.text || "—",
    options: { fill: { color: bg }, color: c.color ?? CV.texto, align: c.align ?? "left", bold: c.bold },
  }));
}

function bridgeWaterfall(
  sl: PptxGenJS.Slide, x: number, y: number, w: number, h: number,
  meta: number, statuses: { label: string; color: string; pp: number }[], atual: number, atualColor: string,
) {
  const wfLabels = [`Meta\n${meta}%`, ...statuses.map((s) => s.label.split(" ").slice(0, 2).join("\n")), "Rupt.\nAtual"];
  const wfVals = [meta, ...statuses.map((s) => +s.pp.toFixed(2)), +atual.toFixed(2)];
  const wfCols = [CV.azul, ...statuses.map((s) => s.color.replace("#", "")), atualColor];
  sl.addChart("bar", [{ name: "Ruptura", labels: wfLabels, values: wfVals }], {
    x, y, w, h, barDir: "col", chartColors: wfCols,
    chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
    catAxisLabelColor: CV.texto, valAxisLabelColor: CV.muted,
    valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
    showValue: true, dataLabelFontSize: 9, dataLabelColor: CV.verdeEsc, showLegend: false,
  });
}

function statusCards(
  sl: PptxGenJS.Slide, y: number, totalW: number, statuses: { label: string; color: string; pp: number; valor: number }[],
) {
  const n = statuses.length || 1;
  const cardW = (totalW - 0.15 * (n - 1)) / n;
  statuses.forEach((s, i) => {
    const bx = 0.3 + i * (cardW + 0.15);
    const cor = s.color.replace("#", "");
    sl.addShape("roundRect", { x: bx, y, w: cardW, h: 1.1, fill: { color: CV.bgCard }, line: { color: cor, width: 1.5 }, rectRadius: 0.08, shadow: shadow() });
    sl.addText(s.label, { x: bx + 0.1, y: y + 0.05, w: cardW - 0.2, h: 0.35, fontSize: 8, bold: true, color: cor, fontFace: "Calibri", margin: 0 });
    sl.addText(`${s.pp.toFixed(2)}pp`, { x: bx + 0.1, y: y + 0.4, w: cardW - 0.2, h: 0.32, fontSize: 15, bold: true, color: cor, fontFace: "Calibri", margin: 0 });
    sl.addText(fv(s.valor), { x: bx + 0.1, y: y + 0.71, w: cardW - 0.2, h: 0.22, fontSize: 8.5, color: CV.muted, fontFace: "Calibri", margin: 0 });
  });
}

function segmentoLabel(s: ComiteSegmento): string {
  return s.segmento;
}

function slideCapa(pres: PptxGenJS, dataFmt: string, meta: number) {
  const sl = pres.addSlide();
  sl.background = { color: CV.verdeEsc };
  sl.addShape("roundRect", { x: 2.5, y: 1.3, w: 8.3, h: 4.9, fill: { color: CV.verde, transparency: 30 }, line: { color: CV.verdeClr }, rectRadius: 0.15 });
  sl.addText("terrazoo", { x: 2.5, y: 1.6, w: 8.3, h: 0.9, fontSize: 42, bold: true, color: CV.verdeClr, fontFace: "Cambria", align: "center", margin: 0 });
  sl.addText("INTELIGÊNCIA COMERCIAL", { x: 2.5, y: 2.45, w: 8.3, h: 0.3, fontSize: 9, color: "7dd4a0", fontFace: "Calibri", align: "center", charSpacing: 5, margin: 0 });
  sl.addShape("line", { x: 3.5, y: 2.83, w: 6.3, h: 0, line: { color: CV.verdeClr, width: 1 } });
  sl.addText("Comitê de Abastecimento", { x: 2.5, y: 2.95, w: 8.3, h: 0.65, fontSize: 30, bold: true, color: CV.branco, fontFace: "Cambria", align: "center", margin: 0 });
  sl.addText("Visão Geral de Ruptura e Estoque", { x: 2.5, y: 3.65, w: 8.3, h: 0.35, fontSize: 14, color: "b0d4b8", fontFace: "Calibri", align: "center", margin: 0 });
  sl.addText(dataFmt, { x: 2.5, y: 4.1, w: 8.3, h: 0.35, fontSize: 14, bold: true, color: CV.verdeClr, fontFace: "Calibri", align: "center", margin: 0 });
  sl.addShape("roundRect", { x: 5.15, y: 4.58, w: 3.0, h: 0.62, fill: { color: CV.verdeMed }, line: { color: CV.verdeClr }, rectRadius: 0.1 });
  sl.addText(`Meta de Ruptura: ${meta}%`, { x: 5.15, y: 4.58, w: 3.0, h: 0.62, fontSize: 12, bold: true, color: CV.branco, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
  ftr(sl, dataFmt);
}

function slideResumo(pres: PptxGenJS, data: ComiteResponse, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, "Resumo do Dia", `Data: ${dataFmt}`);
  const meta = data.meta_percentual;
  const pctOk = data.ruptura_sem_cd.percentual <= meta;

  sl.addShape("roundRect", { x: 0.3, y: 0.82, w: 3.1, h: 1.3, fill: { color: CV.verde }, line: { color: CV.verde }, rectRadius: 0.09, shadow: shadow() });
  sl.addText("% RUPTURA", { x: 0.43, y: 0.89, w: 2.8, h: 0.17, fontSize: 7.5, color: "b0d4b8", bold: true, fontFace: "Calibri", charSpacing: 1, margin: 0 });
  sl.addText(`${data.ruptura_sem_cd.percentual.toFixed(2)}%`, { x: 0.43, y: 1.05, w: 2.8, h: 0.44, fontSize: 21, bold: true, color: pctOk ? "7dd4a0" : "e05555", fontFace: "Calibri", margin: 0 });
  sl.addText(`c/CD: ${data.ruptura_com_cd.percentual.toFixed(2)}%`, { x: 0.43, y: 1.5, w: 2.8, h: 0.17, fontSize: 8.5, bold: true, color: "ffcc88", fontFace: "Calibri", margin: 0 });
  sl.addText(`${dataFmt}  ·  Meta: ${meta}%`, { x: 0.43, y: 1.68, w: 2.8, h: 0.14, fontSize: 7, color: "b0d4b8", fontFace: "Calibri", margin: 0 });
  sl.addShape("roundRect", { x: 0.43, y: 1.86, w: pctOk ? 1.0 : 0.85, h: 0.19, fill: { color: pctOk ? "1a5c38" : "7a2020" }, line: { color: pctOk ? "1a5c38" : "7a2020" }, rectRadius: 0.04 });
  sl.addText(pctOk ? "✓ Dentro da meta" : "▲ Acima da meta", { x: 0.45, y: 1.86, w: pctOk ? 0.96 : 0.81, h: 0.19, fontSize: 6.5, bold: true, color: pctOk ? "7dd4a0" : "ffaaaa", fontFace: "Calibri", valign: "middle", margin: 0 });

  sl.addShape("roundRect", { x: 3.6, y: 0.82, w: 3.1, h: 1.3, fill: { color: CV.verde }, line: { color: CV.verde }, rectRadius: 0.09, shadow: shadow() });
  sl.addText("VALOR EM RUPTURA", { x: 3.73, y: 0.9, w: 2.8, h: 0.2, fontSize: 7.5, color: "b0d4b8", bold: true, fontFace: "Calibri", charSpacing: 1, margin: 0 });
  sl.addText(fv(data.ruptura_sem_cd.valor), { x: 3.73, y: 1.08, w: 2.8, h: 0.52, fontSize: 22, bold: true, color: CV.amareloCl, fontFace: "Calibri", margin: 0 });
  sl.addText("s/ CD", { x: 3.73, y: 1.6, w: 1.0, h: 0.18, fontSize: 8, color: "b0d4b8", fontFace: "Calibri", margin: 0 });
  sl.addText(`${fv(data.ruptura_com_cd.valor)} c/CD`, { x: 3.73, y: 1.78, w: 2.8, h: 0.2, fontSize: 9, bold: true, color: "ffcc88", fontFace: "Calibri", margin: 0 });
  sl.addText(dataFmt, { x: 3.73, y: 1.98, w: 2.8, h: 0.15, fontSize: 7.5, color: "b0d4b8", fontFace: "Calibri", margin: 0 });

  sl.addShape("roundRect", { x: 6.9, y: 0.82, w: 3.1, h: 1.3, fill: { color: CV.verde }, line: { color: CV.verde }, rectRadius: 0.09, shadow: shadow() });
  sl.addText("DDE GERAL", { x: 7.03, y: 0.9, w: 2.8, h: 0.2, fontSize: 7.5, color: "b0d4b8", bold: true, fontFace: "Calibri", charSpacing: 1, margin: 0 });
  sl.addText(`${(data.dde_geral ?? 0).toFixed(1)}d`, { x: 7.03, y: 1.08, w: 2.8, h: 0.52, fontSize: 24, bold: true, color: CV.verdeClr, fontFace: "Calibri", margin: 0 });
  sl.addText("Dias de estoque · Hoje", { x: 7.03, y: 1.56, w: 2.8, h: 0.15, fontSize: 7, color: "b0d4b8", fontFace: "Calibri", margin: 0 });
  data.top_fornecedores_dde.slice(0, 3).forEach((f, fi) => {
    const fy = 1.74 + fi * 0.12;
    sl.addText(f.fornecedor.slice(0, 22), { x: 7.03, y: fy, w: 2.1, h: 0.12, fontSize: 7, color: "b0d4b8", fontFace: "Calibri", margin: 0 });
    sl.addText(`${f.dde.toFixed(0)}d`, { x: 9.1, y: fy, w: 0.65, h: 0.12, fontSize: 7, bold: true, color: CV.verdeClr, fontFace: "Calibri", align: "right", margin: 0 });
  });

  sl.addShape("roundRect", { x: 10.2, y: 0.82, w: 2.85, h: 1.3, fill: { color: CV.verde }, line: { color: CV.verde }, rectRadius: 0.09, shadow: shadow() });
  sl.addText("TOP 3 SEGMENTOS (%)", { x: 10.33, y: 0.9, w: 2.55, h: 0.2, fontSize: 7.5, color: "b0d4b8", bold: true, fontFace: "Calibri", charSpacing: 1, margin: 0 });
  const top3Segs = [...data.segmentos].sort((a, b) => b.percentual - a.percentual).slice(0, 3);
  top3Segs.forEach((ts, tsi) => {
    const ty = 1.12 + tsi * 0.32;
    sl.addText(segmentoLabel(ts), { x: 10.33, y: ty, w: 1.7, h: 0.24, fontSize: 10, bold: true, color: CV.branco, fontFace: "Calibri", margin: 0 });
    sl.addText(`${ts.percentual.toFixed(1)}%`, { x: 11.9, y: ty, w: 0.98, h: 0.24, fontSize: 11, bold: true, color: CV.vermelho, fontFace: "Calibri", align: "right", margin: 0 });
  });

  sl.addText("Ruptura por Segmento", { x: 0.3, y: 2.42, w: 12.7, h: 0.25, fontSize: 10, bold: true, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
  const segsOrdenados = [...data.segmentos].sort((a, b) => (b.percentual - (b.meta ?? 10)) - (a.percentual - (a.meta ?? 10)));
  const segRows: PptxGenJS.TableRow[] = [
    tableHeaderRow([
      { text: "Segmento" }, { text: "% Rupt.", align: "center" }, { text: "Valor R$", align: "right" },
      { text: "Meta %", align: "center" }, { text: "Status", align: "center" },
      { text: "DDE Seg.", align: "center" }, { text: "Meta DDE", align: "center" },
    ]),
    ...segsOrdenados.map((s, i) =>
      tableRow(
        [
          { text: s.segmento, bold: !s.acima_meta ? false : true },
          { text: `${s.percentual.toFixed(1)}%`, align: "center", color: s.acima_meta ? CV.vermelho : CV.verdeMed, bold: true },
          { text: fv(s.valor), align: "right" },
          { text: s.meta != null ? `${s.meta}%` : "—", align: "center", color: CV.muted },
          { text: s.acima_meta ? "Crítico" : "OK", align: "center", color: s.acima_meta ? CV.vermelho : CV.verdeMed, bold: s.acima_meta },
          { text: s.dde != null ? `${s.dde.toFixed(0)}d` : "—", align: "center", color: CV.muted },
          { text: s.dde_meta != null ? `${s.dde_meta}d` : "—", align: "center", color: CV.azul },
        ],
        i,
      ),
    ),
  ];
  sl.addTable(segRows, {
    x: 0.3, y: 2.7, w: 12.7, h: Math.min(4.35, 0.36 * (segsOrdenados.length + 1)),
    colW: [2.8, 1.0, 1.4, 0.9, 1.0, 1.0, 0.8], border: { pt: 0.5, color: "ddeedd" }, fontSize: 9, fontFace: "Calibri",
  });
  ftr(sl, dataFmt);
}

function slideEvolucao(pres: PptxGenJS, data: ComiteResponse, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, "Evolução Diária — Ruptura & DDE", `Últimos ${data.serie_geral.length} dias  |  ${dataFmt}`);
  const labels = data.serie_geral.map((p) => p.data.slice(5));
  const ddeByData = new Map(data.dde_geral_serie.map((p) => [p.data, p.valor ?? 0]));
  const ddeVals = data.serie_geral.map((p) => ddeByData.get(p.data) ?? 0);

  addComboChart(
    sl,
    [
      { type: "line", data: [{ name: "% s/CD", labels, values: data.serie_geral.map((p) => +p.percentual.toFixed(2)) }], options: { chartColors: [CV.verde], lineSize: 2.5 } },
      { type: "line", data: [{ name: "% c/CD", labels, values: data.serie_geral_cd.map((p) => +p.percentual.toFixed(2)) }], options: { chartColors: [CV.verdeClr], lineSize: 2 } },
      { type: "line", data: [{ name: `Meta ${data.meta_percentual}%`, labels, values: labels.map(() => data.meta_percentual) }], options: { chartColors: ["e05555"], lineSize: 1.5, lineDash: "sysDash" } },
    ],
    {
      x: 0.3, y: 0.82, w: 12.7, h: 2.9, chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
      catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
      valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 9, showValue: true, dataLabelFontSize: 7, dataLabelColor: CV.verdeEsc,
    },
  );

  addComboChart(
    sl,
    [
      { type: "bar", data: [{ name: "Valor s/CD", labels, values: data.serie_geral.map((p) => +p.valor.toFixed(0)) }], options: { chartColors: [CV.verde], barDir: "col" } },
      { type: "bar", data: [{ name: "Valor c/CD", labels, values: data.serie_geral_cd.map((p) => +p.valor.toFixed(0)) }], options: { chartColors: [CV.verdeClr], barDir: "col" } },
      { type: "line", data: [{ name: "DDE", labels, values: ddeVals.map((v) => +v.toFixed(1)) }], options: { chartColors: ["c87010"], lineSize: 2 } },
      { type: "line", data: [{ name: `Meta DDE (${data.dde_meta_geral}d)`, labels, values: labels.map(() => data.dde_meta_geral) }], options: { chartColors: ["d4a017"], lineSize: 1.5, lineDash: "sysDash" } },
    ],
    {
      x: 0.3, y: 3.85, w: 12.7, h: 3.1, chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
      catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
      valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 9, showValue: false, barGrouping: "clustered",
    },
  );
  ftr(sl, dataFmt);
}

function slideBridgeGeral(pres: PptxGenJS, data: ComiteResponse, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, "Bridge de Ruptura por Status", dataFmt);
  statusCards(sl, 0.85, 13.3 - 0.6, data.bridge_geral);
  bridgeWaterfall(sl, 0.3, 2.1, 12.7, 4.85, data.meta_percentual, data.bridge_geral, data.ruptura_sem_cd.percentual, CV.verde);
  ftr(sl, dataFmt);
}

function slideSegmentoBridge(pres: PptxGenJS, s: ComiteSegmento, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  const smeta = s.meta ?? 10;
  const pctOkS = s.percentual <= smeta;
  hdr(sl, `Bridge — ${s.segmento}`, `Meta: ${smeta}%  |  ${dataFmt}`);
  kpi(sl, 0.3, 0.85, 2.95, 1.1, "% Ruptura s/CD", `${s.percentual.toFixed(1)}%`, `Meta: ${smeta}%`, pctOkS ? "7dd4a0" : "e05555");
  kpi(sl, 3.45, 0.85, 2.95, 1.1, "% Ruptura c/CD", `${s.percentual_cd.toFixed(1)}%`, "", CV.verdeClr);
  kpi(sl, 6.6, 0.85, 2.95, 1.1, "Valor em Ruptura", fv(s.valor), "", CV.amareloCl);
  kpi(sl, 9.75, 0.85, 3.25, 1.1, "DDE Segmento", s.dde != null ? `${s.dde.toFixed(1)}d` : "—", "Dias de estoque", "7dd4a0");

  if (s.bridge.length > 0) {
    const n = s.bridge.length;
    const cardW = (8.2 - 0.15 * (n - 1)) / n;
    s.bridge.forEach((st, i) => {
      const bx = 0.3 + i * (cardW + 0.15);
      const cor = st.color.replace("#", "");
      sl.addShape("roundRect", { x: bx, y: 2.1, w: cardW, h: 0.9, fill: { color: CV.bgCard }, line: { color: cor, width: 1.5 }, rectRadius: 0.07, shadow: shadow() });
      sl.addText(st.label, { x: bx + 0.08, y: 2.14, w: cardW - 0.16, h: 0.28, fontSize: 7, bold: true, color: cor, fontFace: "Calibri", margin: 0 });
      sl.addText(`${st.pp.toFixed(2)}pp`, { x: bx + 0.08, y: 2.44, w: cardW - 0.16, h: 0.28, fontSize: 12, bold: true, color: cor, fontFace: "Calibri", margin: 0 });
      sl.addText(fv(st.valor), { x: bx + 0.08, y: 2.72, w: cardW - 0.16, h: 0.2, fontSize: 7.5, color: CV.muted, fontFace: "Calibri", margin: 0 });
    });
    bridgeWaterfall(sl, 0.3, 3.1, 8.2, 3.75, smeta, s.bridge, s.percentual, s.percentual > smeta ? CV.vermelho : CV.verde);
  } else if (s.serie.length > 1) {
    const lbl = s.serie.map((p) => p.data.slice(5));
    addComboChart(
      sl,
      [
        { type: "bar", data: [{ name: "s/CD", labels: lbl, values: s.serie.map((p) => +p.percentual.toFixed(2)) }], options: { chartColors: [CV.verde] } },
        { type: "bar", data: [{ name: "c/CD", labels: lbl, values: s.serie_cd.map((p) => +p.percentual.toFixed(2)) }], options: { chartColors: [CV.verdeClr] } },
        { type: "line", data: [{ name: `Meta ${smeta}%`, labels: lbl, values: lbl.map(() => smeta) }], options: { chartColors: ["e05555"] } },
      ],
      {
        x: 0.3, y: 2.1, w: 8.2, h: 4.75, barDir: "col", chartColors: [CV.verde, CV.verdeClr, "e05555"],
        chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
        catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
        valGridLine: { color: "e0e8e0", size: 0.5 }, showLegend: true, legendPos: "t", legendFontSize: 9,
        showValue: false, barGrouping: "clustered",
      },
    );
  }

  sl.addText("Top Fornecedores", { x: 8.65, y: 2.1, w: 4.35, h: 0.28, fontSize: 10, bold: true, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
  const fRows: PptxGenJS.TableRow[] = [
    tableHeaderRow([{ text: "#" }, { text: "Fornecedor" }, { text: "%", align: "center" }, { text: "R$", align: "right" }]),
    ...s.top_fornecedores.map((f, i) =>
      tableRow(
        [
          { text: String(i + 1).padStart(2, "0"), color: CV.muted },
          { text: `${f.fornecedor.slice(0, 20)}${f.dde ? ` (${f.dde.toFixed(0)}d)` : ""}`, color: CV.verdeEsc, bold: i === 0 },
          { text: `${f.percentual.toFixed(1)}%`, align: "center", color: f.percentual > smeta ? CV.vermelho : CV.verdeMed, bold: true },
          { text: fv(f.valor), align: "right", color: CV.amarelo },
        ],
        i,
      ),
    ),
  ];
  sl.addTable(fRows, { x: 8.65, y: 2.42, w: 4.35, h: 4.43, colW: [0.42, 2.3, 0.8, 0.83], border: { pt: 0.5, color: "ddeedd" }, fontSize: 9, fontFace: "Calibri" });
  ftr(sl, dataFmt);
}

function slideRankingLojas(pres: PptxGenJS, data: ComiteResponse, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, "Ranking de Lojas — % Ruptura", dataFmt);
  const lojasMeta = data.lojas.filter((l) => l.percentual <= 10).sort((a, b) => a.percentual - b.percentual);
  const lojasCrit = data.lojas.filter((l) => l.percentual > 10).sort((a, b) => b.percentual - a.percentual);

  sl.addShape("roundRect", { x: 0.3, y: 0.85, w: 6.2, h: 3.1, fill: { color: CV.bgCard }, line: { color: "c5e8d5", width: 1 }, rectRadius: 0.1, shadow: shadow() });
  sl.addText(`✓ Dentro da Meta (${lojasMeta.length})`, { x: 0.4, y: 0.93, w: 5.9, h: 0.25, fontSize: 9, bold: true, color: CV.verdeMed, fontFace: "Calibri", margin: 0 });
  lojasMeta.slice(0, 10).forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 0.4 + col * 3.05, ly = 1.25 + row * 0.42;
    sl.addShape("roundRect", { x: lx, y: ly, w: 2.9, h: 0.36, fill: { color: "f0faf5" }, line: { color: "c5e8d5" }, rectRadius: 0.06 });
    sl.addText(l.nome, { x: lx + 0.1, y: ly + 0.03, w: 2.0, h: 0.28, fontSize: 9, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
    sl.addText(`${l.percentual.toFixed(1)}%`, { x: lx + 2.05, y: ly + 0.03, w: 0.7, h: 0.28, fontSize: 10, bold: true, color: CV.verdeMed, fontFace: "Calibri", align: "right", margin: 0 });
  });

  sl.addShape("roundRect", { x: 6.8, y: 0.85, w: 6.2, h: 3.1, fill: { color: CV.bgCard }, line: { color: "ffcccc", width: 1 }, rectRadius: 0.1, shadow: shadow() });
  sl.addText(`⚠ Acima da Meta (${lojasCrit.length})`, { x: 6.9, y: 0.93, w: 5.9, h: 0.25, fontSize: 9, bold: true, color: CV.vermelho, fontFace: "Calibri", margin: 0 });
  lojasCrit.slice(0, 10).forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 6.9 + col * 3.05, ly = 1.25 + row * 0.42;
    sl.addShape("roundRect", { x: lx, y: ly, w: 2.9, h: 0.36, fill: { color: "fff8f8" }, line: { color: "ffcccc" }, rectRadius: 0.06 });
    sl.addText(l.nome, { x: lx + 0.1, y: ly + 0.03, w: 2.0, h: 0.28, fontSize: 9, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
    sl.addText(`${l.percentual.toFixed(1)}%`, { x: lx + 2.05, y: ly + 0.03, w: 0.7, h: 0.28, fontSize: 10, bold: true, color: CV.vermelho, fontFace: "Calibri", align: "right", margin: 0 });
  });

  sl.addText("Tabela Detalhada", { x: 0.3, y: 4.1, w: 5, h: 0.28, fontSize: 10, bold: true, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
  const lojasOrdenadas = [...data.lojas].sort((a, b) => b.percentual - a.percentual).slice(0, 10);
  const tRows: PptxGenJS.TableRow[] = [
    tableHeaderRow([{ text: "#" }, { text: "Loja" }, { text: "%", align: "center" }, { text: "R$", align: "right" }, { text: "DDE", align: "center" }, { text: "Status", align: "center" }]),
    ...lojasOrdenadas.map((l, i) =>
      tableRow(
        [
          { text: String(i + 1).padStart(2, "0"), color: CV.muted },
          { text: l.nome, color: CV.verdeEsc, bold: i < 3 },
          { text: `${l.percentual.toFixed(1)}%`, align: "center", color: l.percentual > 10 ? CV.vermelho : CV.verdeMed, bold: true },
          { text: fv(l.valor), align: "right", color: CV.amarelo },
          { text: l.dde != null ? `${l.dde.toFixed(0)}d` : "—", align: "center", color: CV.muted },
          { text: l.percentual > 10 ? "⚠ Crítico" : "✓ OK", align: "center", color: l.percentual > 10 ? CV.vermelho : CV.verdeMed, bold: l.percentual > 10 },
        ],
        i,
      ),
    ),
  ];
  sl.addTable(tRows, { x: 0.3, y: 4.42, w: 12.7, h: 2.5, colW: [0.5, 3.5, 1.0, 1.5, 1.0, 1.2], border: { pt: 0.5, color: "ddeedd" }, fontSize: 9, fontFace: "Calibri" });
  ftr(sl, dataFmt);
}

function slideLojaCritica(pres: PptxGenJS, data: ComiteResponse, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  const lj = data.loja_critica;
  hdr(sl, `Loja Crítica: ${lj?.nome ?? "—"}`, `Maior Ruptura  |  ${dataFmt}`);
  if (lj) {
    kpi(sl, 0.3, 0.85, 3.0, 1.1, "% Ruptura", `${lj.percentual.toFixed(1)}%`, `Meta: ${data.meta_percentual}%`, lj.percentual > data.meta_percentual ? "e05555" : "7dd4a0");
    kpi(sl, 3.5, 0.85, 3.0, 1.1, "Valor em Ruptura", fv(lj.valor), "", CV.amareloCl);
    kpi(sl, 6.7, 0.85, 2.8, 1.1, "DDE", lj.dde != null ? `${lj.dde.toFixed(1)}d` : "—", "Dias de estoque", CV.verdeClr);
    kpi(sl, 9.7, 0.85, 3.3, 1.1, "Rank", "#1 em Ruptura", "vs todas as lojas", CV.vermelho);

    sl.addText("Top Itens com Maior Valor em Ruptura", { x: 0.3, y: 2.1, w: 8.5, h: 0.28, fontSize: 10, bold: true, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
    const itRows: PptxGenJS.TableRow[] = [
      tableHeaderRow([{ text: "#" }, { text: "Produto" }, { text: "Segmento" }, { text: "Valor R$", align: "right" }]),
      ...lj.top_itens.slice(0, 10).map((it, i) =>
        tableRow(
          [
            { text: String(i + 1).padStart(2, "0"), color: CV.muted },
            { text: (it.produto ?? "—").slice(0, 35), color: CV.verdeEsc, bold: i === 0 },
            { text: it.segmento ?? "—", color: CV.azul },
            { text: fv(it.valor), align: "right", color: CV.amarelo, bold: true },
          ],
          i,
        ),
      ),
    ];
    sl.addTable(itRows, { x: 0.3, y: 2.42, w: 8.5, h: 4.5, colW: [0.5, 4.0, 2.5, 1.5], border: { pt: 0.5, color: "ddeedd" }, fontSize: 9, fontFace: "Calibri" });

    sl.addText(`Ruptura por Segmento — ${lj.nome}`, { x: 9.05, y: 2.1, w: 3.95, h: 0.28, fontSize: 10, bold: true, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
    const segEntries = [...lj.segmentos_ofensores].sort((a, b) => b.valor - a.valor).slice(0, 12);
    const sgRows: PptxGenJS.TableRow[] = [
      tableHeaderRow([{ text: "Segmento" }, { text: "R$", align: "right" }]),
      ...segEntries.map((sg, i) => tableRow([{ text: sg.segmento, color: CV.verdeEsc }, { text: fv(sg.valor), align: "right", color: CV.amarelo }], i)),
    ];
    sl.addTable(sgRows, { x: 9.05, y: 2.42, w: 3.95, h: 4.5, colW: [2.5, 1.45], border: { pt: 0.5, color: "ddeedd" }, fontSize: 9, fontFace: "Calibri" });
  }
  ftr(sl, dataFmt);
}

function slideVisaoFornecedor(pres: PptxGenJS, data: ComiteResponse, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, "Visão por Fornecedor — Top 3 por Segmento", dataFmt);
  const cols = 3, cellW = 4.2, cellH = 2.0, gapX = 0.15, gapY = 0.1;
  data.segmentos.slice(0, 9).forEach((s, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const gx = 0.25 + col * (cellW + gapX);
    const gy = 0.85 + row * (cellH + gapY);
    const smeta = s.meta ?? 10;
    const hdrCol = s.percentual <= smeta ? CV.verde : CV.vermelho;
    sl.addShape("roundRect", { x: gx, y: gy, w: cellW, h: cellH, fill: { color: CV.bgCard }, line: { color: hdrCol, width: 1 }, rectRadius: 0.08, shadow: shadow() });
    sl.addShape("roundRect", { x: gx, y: gy, w: cellW, h: 0.42, fill: { color: hdrCol }, line: { color: hdrCol }, rectRadius: 0.08 });
    sl.addShape("rect", { x: gx, y: gy + 0.22, w: cellW, h: 0.2, fill: { color: hdrCol }, line: { color: hdrCol } });
    sl.addText(s.segmento, { x: gx + 0.1, y: gy + 0.03, w: cellW * 0.55, h: 0.18, fontSize: 9, bold: true, color: CV.branco, fontFace: "Calibri", margin: 0 });
    sl.addText(`${s.percentual.toFixed(1)}%`, { x: gx + 0.1, y: gy + 0.22, w: cellW * 0.4, h: 0.18, fontSize: 9, bold: true, color: CV.branco, fontFace: "Calibri", margin: 0 });
    if (s.dde != null) sl.addText(`DDE:${s.dde.toFixed(0)}d`, { x: gx + cellW * 0.5, y: gy + 0.22, w: cellW * 0.48, h: 0.18, fontSize: 8.5, color: "ddeedd", fontFace: "Calibri", align: "right", margin: 0 });
    sl.addText(fv(s.valor), { x: gx + cellW * 0.55, y: gy + 0.03, w: cellW * 0.43, h: 0.18, fontSize: 8.5, color: "ddeedd", fontFace: "Calibri", align: "right", margin: 0 });

    const top3 = s.top_fornecedores.slice(0, 3);
    top3.forEach((f, fi) => {
      const fy = gy + 0.5 + fi * 0.47;
      sl.addText(`${fi + 1}.`, { x: gx + 0.1, y: fy, w: 0.18, h: 0.22, fontSize: 9, bold: true, color: hdrCol, fontFace: "Calibri", margin: 0 });
      sl.addText(f.fornecedor.slice(0, 22), { x: gx + 0.3, y: fy, w: cellW * 0.5, h: 0.22, fontSize: 8.5, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
      sl.addText(fv(f.valor), { x: gx + 0.3 + cellW * 0.5, y: fy, w: cellW * 0.23, h: 0.22, fontSize: 8, color: CV.amarelo, fontFace: "Calibri", align: "right", margin: 0 });
      const pBg = f.percentual > smeta ? "ffe0e0" : "e8f5ee";
      const pTx = f.percentual > smeta ? CV.vermelho : CV.verdeMed;
      sl.addShape("roundRect", { x: gx + cellW - 0.72, y: fy + 0.02, w: 0.68, h: 0.2, fill: { color: pBg }, line: { color: pBg }, rectRadius: 0.04 });
      sl.addText(`${f.percentual.toFixed(1)}%${f.dde ? ` ${f.dde.toFixed(0)}d` : ""}`, { x: gx + cellW - 0.72, y: fy + 0.02, w: 0.68, h: 0.2, fontSize: 7.5, bold: true, color: pTx, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
    });
    if (!top3.length) {
      sl.addText("Sem dados", { x: gx + 0.1, y: gy + 0.55, w: cellW - 0.2, h: 0.3, fontSize: 8, color: CV.muted, fontFace: "Calibri", italic: true, margin: 0 });
    }
  });
  ftr(sl, dataFmt);
}

function slideCurvasResumo(pres: PptxGenJS, data: ComiteResponse, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, "Ruptura por Curvas ABC — Resumo do Dia", dataFmt);
  const lastByC: Record<string, ComiteCurvaPonto | undefined> = {};
  CURVAS.forEach((c) => {
    const pts = data.curvas.pontos[c];
    lastByC[c] = pts[pts.length - 1];
  });
  CURVAS.forEach((c, i) => {
    const cor = COR_CURVA[c];
    const x = 0.3 + i * 3.2;
    const ultimo = lastByC[c];
    sl.addShape("roundRect", { x, y: 0.85, w: 3.1, h: 2.5, fill: { color: CV.bgCard }, line: { color: cor, width: 2 }, rectRadius: 0.1, shadow: shadow() });
    sl.addShape("roundRect", { x, y: 0.85, w: 3.1, h: 0.5, fill: { color: cor }, line: { color: cor }, rectRadius: 0.1 });
    sl.addShape("rect", { x, y: 1.1, w: 3.1, h: 0.25, fill: { color: cor }, line: { color: cor } });
    sl.addText(`Curva ${c}`, { x: x + 0.1, y: 0.88, w: 2.9, h: 0.42, fontSize: 16, bold: true, color: CV.branco, fontFace: "Cambria", align: "center", margin: 0 });
    sl.addText("Ruptura Específica", { x: x + 0.1, y: 1.45, w: 2.9, h: 0.22, fontSize: 9, color: CV.muted, fontFace: "Calibri", align: "center", margin: 0 });
    sl.addText(`${(ultimo?.pct ?? 0).toFixed(2)}%`, { x: x + 0.1, y: 1.68, w: 2.9, h: 0.55, fontSize: 22, bold: true, color: cor, fontFace: "Calibri", align: "center", margin: 0 });
    sl.addText("Ruptura em PP", { x: x + 0.1, y: 2.3, w: 2.9, h: 0.22, fontSize: 9, color: CV.muted, fontFace: "Calibri", align: "center", margin: 0 });
    sl.addText(`${(ultimo?.pp ?? 0).toFixed(2)}pp`, { x: x + 0.1, y: 2.52, w: 2.9, h: 0.55, fontSize: 18, bold: true, color: cor, fontFace: "Calibri", align: "center", margin: 0 });
  });

  const hist10 = data.curvas.pontos.A.slice(-10).map((p) => p.data);
  sl.addText("Histórico — Ruptura Específica por Curva (últimos 10 registros)", { x: 0.3, y: 3.55, w: 12.7, h: 0.28, fontSize: 10, bold: true, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
  const hdrRow = tableHeaderRow([{ text: "Data" }, ...CURVAS.map((c) => ({ text: `Curva ${c}`, align: "center" as const }))]);
  const dataRows = hist10.map((data_, i) =>
    tableRow(
      [
        { text: data_, color: CV.muted },
        ...CURVAS.map((c) => {
          const ponto = data.curvas.pontos[c].find((p) => p.data === data_);
          return { text: `${(ponto?.pct ?? 0).toFixed(2)}%`, align: "center" as const, color: COR_CURVA[c], bold: true };
        }),
      ],
      i,
    ),
  );
  sl.addTable([hdrRow, ...dataRows], { x: 0.3, y: 3.87, w: 12.7, h: 3.0, colW: [2.2, 2.6, 2.6, 2.6, 2.7], border: { pt: 0.5, color: "ddeedd" }, fontSize: 9, fontFace: "Calibri" });
  ftr(sl, dataFmt);
}

function slideCurvaPercentual(pres: PptxGenJS, data: ComiteResponse, curva: (typeof CURVAS)[number], dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, `Ruptura Específica — Curva ${curva}`, `Histórico completo  |  ${dataFmt}`);
  const pontos = data.curvas.pontos[curva];
  const cor = COR_CURVA[curva];
  if (pontos.length > 1) {
    const labels = pontos.map((p) => p.data);
    sl.addChart("line", [{ name: `Curva ${curva} — Rupt. Específica (%)`, labels, values: pontos.map((p) => +p.pct.toFixed(2)) }], {
      x: 0.3, y: 0.82, w: 12.7, h: 2.9, chartColors: [cor], lineSize: 2.5,
      chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
      catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
      valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 10, showValue: true, dataLabelFontSize: 8, dataLabelColor: cor,
    });
    const comValor = pontos.filter((p) => p.valor != null);
    if (comValor.length > 1) {
      sl.addChart("bar", [{ name: `Curva ${curva} — Valor R$`, labels: comValor.map((p) => p.data), values: comValor.map((p) => +(p.valor ?? 0).toFixed(0)) }], {
        x: 0.3, y: 3.85, w: 12.7, h: 3.1, barDir: "col", chartColors: [cor],
        chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
        catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
        valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
        showLegend: true, legendPos: "t", legendFontSize: 10, showValue: true, dataLabelFontSize: 7, dataLabelColor: CV.verdeEsc,
      });
    }
  } else {
    sl.addText("Dados insuficientes para gráfico.", { x: 1, y: 3, w: 11, h: 1, fontSize: 12, color: CV.muted, fontFace: "Calibri", align: "center", italic: true, margin: 0 });
  }
  ftr(sl, dataFmt);
}

function slideCurvaPP(pres: PptxGenJS, data: ComiteResponse, curva: (typeof CURVAS)[number], dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, `Ruptura em Pontos Percentuais — Curva ${curva}`, `Histórico completo  |  ${dataFmt}`);
  const pontos = data.curvas.pontos[curva].filter((p) => p.pp != null);
  const cor = COR_CURVA[curva];
  if (pontos.length > 1) {
    const labels = pontos.map((p) => p.data);
    sl.addChart("line", [{ name: `Curva ${curva} — PP (%)`, labels, values: pontos.map((p) => +(p.pp ?? 0).toFixed(2)) }], {
      x: 0.3, y: 0.82, w: 12.7, h: 2.9, chartColors: [cor], lineSize: 2.5,
      chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
      catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
      valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 10, showValue: true, dataLabelFontSize: 8, dataLabelColor: cor,
    });
    sl.addChart("bar", [{ name: `Curva ${curva} — Valor R$`, labels, values: pontos.map((p) => +(p.valor ?? 0).toFixed(0)) }], {
      x: 0.3, y: 3.85, w: 12.7, h: 3.1, barDir: "col", chartColors: [cor],
      chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
      catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
      valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 10, showValue: true, dataLabelFontSize: 7, dataLabelColor: CV.verdeEsc,
    });
  } else {
    sl.addText("Dados insuficientes para gráfico.", { x: 1, y: 3, w: 11, h: 1, fontSize: 12, color: CV.muted, fontFace: "Calibri", align: "center", italic: true, margin: 0 });
  }
  ftr(sl, dataFmt);
}

function slideCurvasIndisponivel(pres: PptxGenJS, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  hdr(sl, "Ruptura por Curvas ABC", dataFmt);
  sl.addText(
    "Dados de curva ABC não disponíveis para o período selecionado.\nAs slides de detalhamento por curva foram omitidas desta apresentação.",
    { x: 2, y: 2.5, w: 9.3, h: 2, fontSize: 14, color: CV.muted, fontFace: "Calibri", align: "center", italic: true, margin: 0 },
  );
  ftr(sl, dataFmt);
}

function slideSegmentoFixo(pres: PptxGenJS, s: ComiteSegmento, dataFmt: string) {
  const sl = pres.addSlide();
  sl.background = { color: CV.bg };
  const smeta = s.meta ?? 10;
  const pctOkS = s.percentual <= smeta;
  hdr(sl, `Segmento: ${s.segmento}`, `Meta: ${smeta}%  |  ${dataFmt}`);
  kpi(sl, 0.3, 0.85, 2.95, 1.1, "% Ruptura s/CD", `${s.percentual.toFixed(1)}%`, `Meta: ${smeta}%`, pctOkS ? "7dd4a0" : "e05555");
  kpi(sl, 3.45, 0.85, 2.95, 1.1, "% Ruptura c/CD", `${s.percentual_cd.toFixed(1)}%`, "", CV.verdeClr);
  kpi(sl, 6.6, 0.85, 2.95, 1.1, "Valor em Ruptura", fv(s.valor), "", CV.amareloCl);
  kpi(sl, 9.75, 0.85, 3.25, 1.1, "DDE Segmento", s.dde != null ? `${s.dde.toFixed(1)}d` : "—", "Dias de estoque", "7dd4a0");

  if (s.serie.length > 1) {
    const lbl = s.serie.map((p) => p.data.slice(5));
    addComboChart(
      sl,
      [
        { type: "line", data: [{ name: "% s/CD", labels: lbl, values: s.serie.map((p) => +p.percentual.toFixed(2)) }], options: { chartColors: [CV.verde], lineSize: 2.5 } },
        { type: "line", data: [{ name: "% c/CD", labels: lbl, values: s.serie_cd.map((p) => +p.percentual.toFixed(2)) }], options: { chartColors: [CV.verdeClr], lineSize: 2 } },
        { type: "line", data: [{ name: `Meta ${smeta}%`, labels: lbl, values: lbl.map(() => smeta) }], options: { chartColors: ["e05555"], lineSize: 1.5, lineDash: "sysDash" } },
      ],
      {
        x: 0.3, y: 2.1, w: 8.5, h: 2.2, chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
        catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
        valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
        showLegend: true, legendPos: "t", legendFontSize: 8, showValue: true, dataLabelFontSize: 7, dataLabelColor: CV.verdeEsc,
      },
    );

    const ddeByData = new Map(s.serie_dde.map((p) => [p.data, p.valor ?? 0]));
    const chartData: PptxGenJS.IChartMulti[] = [
      { type: "bar", data: [{ name: "Valor s/CD", labels: lbl, values: s.serie.map((p) => +p.valor.toFixed(0)) }], options: { chartColors: [CV.verde], barDir: "col" } },
      { type: "bar", data: [{ name: "Valor c/CD", labels: lbl, values: s.serie_cd.map((p) => +p.valor.toFixed(0)) }], options: { chartColors: [CV.verdeClr], barDir: "col" } },
      { type: "line", data: [{ name: "DDE", labels: lbl, values: s.serie.map((p) => +(ddeByData.get(p.data) ?? 0).toFixed(1)) }], options: { chartColors: ["c87010"], lineSize: 2 } },
    ];
    if (s.dde_meta != null) {
      chartData.push({ type: "line", data: [{ name: `Meta DDE (${s.dde_meta}d)`, labels: lbl, values: lbl.map(() => s.dde_meta as number) }], options: { chartColors: ["d4a017"], lineSize: 1.5, lineDash: "sysDash" } });
    }
    addComboChart(sl, chartData, {
      x: 0.3, y: 4.42, w: 8.5, h: 2.6, chartArea: { fill: { color: CV.bgCard }, roundedCorners: true },
      catAxisLabelColor: CV.muted, valAxisLabelColor: CV.muted,
      valGridLine: { color: "e0e8e0", size: 0.5 }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 8, showValue: false, barGrouping: "clustered",
    });
  }

  sl.addText("Top Fornecedores", { x: 9.05, y: 2.1, w: 3.95, h: 0.28, fontSize: 10, bold: true, color: CV.verdeEsc, fontFace: "Calibri", margin: 0 });
  const fRows: PptxGenJS.TableRow[] = [
    tableHeaderRow([{ text: "#" }, { text: "Fornecedor" }, { text: "%", align: "center" }, { text: "DDE", align: "center" }, { text: "R$", align: "right" }]),
    ...s.top_fornecedores.map((f, i) =>
      tableRow(
        [
          { text: String(i + 1).padStart(2, "0"), color: CV.muted },
          { text: f.fornecedor.slice(0, 18), color: CV.verdeEsc, bold: i === 0 },
          { text: `${f.percentual.toFixed(1)}%`, align: "center", color: f.percentual > smeta ? CV.vermelho : CV.verdeMed, bold: true },
          { text: f.dde != null ? `${f.dde.toFixed(0)}d` : "—", align: "center", color: CV.muted },
          { text: fv(f.valor), align: "right", color: CV.amarelo },
        ],
        i,
      ),
    ),
  ];
  sl.addTable(fRows, { x: 9.05, y: 2.42, w: 3.95, h: 4.43, colW: [0.38, 1.8, 0.72, 0.6, 0.45], border: { pt: 0.5, color: "ddeedd" }, fontSize: 9, fontFace: "Calibri" });
  ftr(sl, dataFmt);
}

export async function gerarComitePptx(data: ComiteResponse): Promise<void> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "TerraZoo — Comitê de Abastecimento";

  const dataFmt = formatDateFull(data.data_referencia);

  slideCapa(pres, dataFmt, data.meta_percentual);
  slideResumo(pres, data, dataFmt);
  slideEvolucao(pres, data, dataFmt);
  slideBridgeGeral(pres, data, dataFmt);

  const top4 = [...data.segmentos]
    .map((s) => ({ s, delta: s.percentual - (s.meta ?? 10) }))
    .filter((x) => x.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);
  top4.forEach(({ s }) => slideSegmentoBridge(pres, s, dataFmt));

  slideRankingLojas(pres, data, dataFmt);
  slideLojaCritica(pres, data, dataFmt);
  slideVisaoFornecedor(pres, data, dataFmt);

  if (data.curvas.disponivel) {
    slideCurvasResumo(pres, data, dataFmt);
    CURVAS.forEach((c) => slideCurvaPercentual(pres, data, c, dataFmt));
    CURVAS.forEach((c) => slideCurvaPP(pres, data, c, dataFmt));
  } else {
    slideCurvasIndisponivel(pres, dataFmt);
  }

  data.segmentos.forEach((s) => slideSegmentoFixo(pres, s, dataFmt));

  const nomeArq = `TerraZoo_Comite_${data.data_referencia}.pptx`;
  await pres.writeFile({ fileName: nomeArq });
}
