// Exporta relatórios da corretora para PDF (com a marca) e Excel.
// O PDF é gerado no navegador com jsPDF (carregado só quando usado).
import { gerarXlsx, type Celula, type Planilha } from "@/lib/backup/xlsx";
import { baixar } from "@/lib/backup/backup";
import { dateBR, money } from "@/lib/format";

export type TipoColuna = "texto" | "data" | "moeda" | "numero" | "inteiro";
export type Coluna = {
  titulo: string;
  tipo?: TipoColuna | undefined;
  /** Largura relativa (em caracteres, também usada no Excel). */
  largura?: number | undefined;
};
export type Valor = string | number | null | undefined;
export type Secao = {
  titulo?: string | undefined;
  colunas?: Coluna[] | undefined;
  linhas?: Valor[][] | undefined;
  /** Ficha (rótulo → valor), em duas colunas, no lugar de uma tabela. */
  campos?: [string, string][] | undefined;
  /** Parágrafo de texto livre. */
  texto?: string | undefined;
  /** Linha de totais (mesma ordem das colunas). */
  totais?: Valor[] | undefined;
};
export type Relatorio = {
  titulo: string;
  subtitulo?: string | undefined;
  /** Nome da corretora. */
  empresa: string;
  /** Pares "rótulo: valor" exibidos abaixo do título. */
  resumo?: [string, string][] | undefined;
  secoes: Secao[];
  /** Nome-base do arquivo, sem extensão. */
  arquivo: string;
  /** Texto e linha de assinatura no fim do documento (ex.: recibo). */
  assinatura?: { texto: string; nome: string } | undefined;
  /** Página deitada (padrão quando há muitas colunas). */
  paisagem?: boolean | undefined;
};

const AZUL: [number, number, number] = [11, 79, 138];
const CELESTE: [number, number, number] = [231, 242, 252];

export function nomeArquivo(base: string): string {
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug || "relatorio";
}

export function textoCelula(v: Valor, tipo: TipoColuna = "texto"): string {
  if (v === null || v === undefined || v === "") return "";
  if (tipo === "moeda") return money(v);
  if (tipo === "data")
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? dateBR(v) : String(v);
  if (tipo === "numero" && typeof v === "number")
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(v);
}

function celulaExcel(v: Valor, tipo: TipoColuna = "texto", total = false): Celula {
  if (v === null || v === undefined || v === "") return v;
  if (tipo === "moeda" && typeof v === "number") return { v, f: total ? "moeda-negrito" : "moeda" };
  if (tipo === "data") return total ? { v, f: "negrito" } : { v, f: "data" };
  if (tipo === "numero" && typeof v === "number") return { v, f: "numero" };
  return total ? { v, f: "negrito" } : v;
}

const emitidoEm = () =>
  new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// ---------- Excel ----------
export function relatorioXlsx(r: Relatorio): Blob {
  const cabecalho = [
    `${r.empresa} — ${r.titulo}`,
    ...(r.subtitulo ? [r.subtitulo] : []),
    ...(r.resumo ?? []).map(([k, v]) => `${k}: ${v}`),
    `Emitido em ${emitidoEm()} · Corretix`,
  ];
  const usados = new Set<string>();
  const planilhas: Planilha[] = r.secoes.map((s, i) => {
    let nome = (s.titulo || r.titulo)
      .replace(/[\\/?*[\]:]/g, " ")
      .slice(0, 31)
      .trim();
    while (usados.has(nome)) nome = `${nome.slice(0, 28)} ${i + 1}`;
    usados.add(nome);
    const colunas = s.colunas ?? [];
    const linhas: Celula[][] = s.campos
      ? [["Campo", "Valor"], ...s.campos.map(([k, v]) => [k, v])]
      : s.texto
        ? [[s.titulo ?? ""], [s.texto]]
        : [
            colunas.map((c) => c.titulo),
            ...(s.linhas ?? []).map((l) => l.map((v, j) => celulaExcel(v, colunas[j]?.tipo))),
          ];
    if (s.totais) linhas.push(s.totais.map((v, j) => celulaExcel(v, colunas[j]?.tipo, true)));
    return {
      nome,
      titulo: i === 0 ? cabecalho : [`${r.empresa} — ${s.titulo ?? r.titulo}`],
      linhas,
      larguras: s.campos
        ? [28, 60]
        : s.texto
          ? [100]
          : colunas.map((c) => Math.max(c.largura ?? 14, c.titulo.length + 2)),
    };
  });
  return gerarXlsx(planilhas);
}

export function baixarExcel(r: Relatorio) {
  baixar(relatorioXlsx(r), `${nomeArquivo(r.arquivo)}.xlsx`);
}

// ---------- PDF ----------
let logoCache: Promise<string | null> | null = null;
function carregarLogo(): Promise<string | null> {
  logoCache ??= fetch("/email/logo-corretix.png")
    .then((res) => (res.ok ? res.blob() : null))
    .then(
      (b) =>
        b &&
        new Promise<string | null>((ok) => {
          const fr = new FileReader();
          fr.onload = () => ok(typeof fr.result === "string" ? fr.result : null);
          fr.onerror = () => ok(null);
          fr.readAsDataURL(b);
        }),
    )
    .catch(() => null);
  return logoCache;
}

type LogoImg = { data: string; w: number; h: number; fmt: "PNG" | "JPEG" };
async function carregarLogoEmpresa(): Promise<LogoImg | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { urlLogoEmpresa } = await import("@/lib/data/workspace");
    const { data } = await supabase.from("empresas").select("logo_url").limit(1).maybeSingle();
    const url = await urlLogoEmpresa(data?.logo_url);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((ok, ko) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = ko;
      fr.readAsDataURL(blob);
    });
    const dim = await new Promise<{ w: number; h: number }>((ok, ko) => {
      const im = new Image();
      im.onload = () => ok({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = ko;
      im.src = dataUrl;
    });
    return { data: dataUrl, ...dim, fmt: blob.type === "image/png" ? "PNG" : "JPEG" };
  } catch {
    return null;
  }
}

export async function relatorioPdf(original: Relatorio): Promise<Blob> {
  // As fontes padrão do PDF (Latin-1) não têm a seta "→".
  const r = JSON.parse(JSON.stringify(original).replace(/\u2192/g, "»")) as Relatorio;
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    carregarLogo(),
  ]);
  const logoEmp = await carregarLogoEmpresa();
  const maxCols = Math.max(0, ...r.secoes.map((s) => s.colunas?.length ?? 0));
  const paisagem = r.paisagem ?? maxCols > 6;
  const doc = new jsPDF({
    orientation: paisagem ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  // Cabeçalho da primeira página
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, W, 3, "F");
  if (logo) doc.addImage(logo, "PNG", M, 8, 33, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  if (logoEmp) {
    const h = 12;
    const w = Math.min(40, (logoEmp.w / logoEmp.h) * h);
    const hh = (w / logoEmp.w) * logoEmp.h;
    doc.addImage(logoEmp.data, logoEmp.fmt, W - M - w, 6 + (h - hh) / 2, w, hh);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.text(r.empresa, W / 2, 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  doc.text(`Emitido em ${emitidoEm()}`, W / 2, 15.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...AZUL);
  doc.text(r.titulo, M, 26);
  let y = 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70);
  if (r.subtitulo) {
    y += 5.5;
    doc.text(r.subtitulo, M, y);
  }
  if (r.resumo?.length) {
    y += 4;
    const larg = (W - 2 * M) / Math.min(r.resumo.length, paisagem ? 6 : 4);
    r.resumo.forEach(([k, v], i) => {
      const porLinha = Math.min(r.resumo?.length ?? 1, paisagem ? 6 : 4);
      const cx = M + (i % porLinha) * larg;
      const cy = y + Math.floor(i / porLinha) * 13;
      doc.setFillColor(...CELESTE);
      doc.roundedRect(cx, cy, larg - 2, 11, 1.5, 1.5, "F");
      doc.setFontSize(7.5);
      doc.setTextColor(90);
      doc.text(k.toUpperCase(), cx + 2.5, cy + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...AZUL);
      doc.text(v, cx + 2.5, cy + 9);
      doc.setFont("helvetica", "normal");
    });
    const porLinha = Math.min(r.resumo.length, paisagem ? 6 : 4);
    y += Math.ceil(r.resumo.length / porLinha) * 13 - 2;
  }
  y += 5;

  for (const s of r.secoes) {
    if (s.titulo) {
      if (y > H - 30) {
        doc.addPage();
        y = 16;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...AZUL);
      doc.text(s.titulo, M, y + 2);
      y += 5;
    }
    const util = W - 2 * M;
    if (s.texto) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(50);
      const linhasTxt = doc.splitTextToSize(s.texto, util) as string[];
      if (y + linhasTxt.length * 4.5 > H - 16) {
        doc.addPage();
        y = 16;
      }
      doc.text(linhasTxt, M, y + 3);
      y += linhasTxt.length * 4.5 + 6;
      continue;
    }
    if (s.campos) {
      const pares = s.campos.filter(([, v]) => v);
      const body: string[][] = [];
      for (let k = 0; k < pares.length; k += 2) {
        const a = pares[k];
        const b = pares[k + 1];
        body.push([a?.[0] ?? "", a?.[1] ?? "", b?.[0] ?? "", b?.[1] ?? ""]);
      }
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M, top: 14, bottom: 14 },
        body,
        theme: "plain",
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.4, overflow: "linebreak" },
        columnStyles: {
          0: { cellWidth: util * 0.17, textColor: 110, fontStyle: "bold", fontSize: 7.5 },
          1: { cellWidth: util * 0.33 },
          2: { cellWidth: util * 0.17, textColor: 110, fontStyle: "bold", fontSize: 7.5 },
          3: { cellWidth: util * 0.33 },
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
      continue;
    }
    const colunas = s.colunas ?? [];
    const pesos = colunas.map((c) => c.largura ?? 14);
    const soma = pesos.reduce((a, b) => a + b, 0);
    const alinhar = (t?: TipoColuna) =>
      t === "moeda" || t === "numero" || t === "inteiro" ? ("right" as const) : ("left" as const);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 14, bottom: 14 },
      head: [colunas.map((c) => ({ content: c.titulo, styles: { halign: alinhar(c.tipo) } }))],
      body: (s.linhas ?? []).map((l) => l.map((v, j) => textoCelula(v, colunas[j]?.tipo))),
      ...(s.totais
        ? {
            foot: [
              s.totais.map((v, j) => ({
                content: textoCelula(v, colunas[j]?.tipo),
                styles: { halign: alinhar(colunas[j]?.tipo) },
              })),
            ],
          }
        : {}),
      showFoot: "lastPage",
      theme: "striped",
      styles: {
        font: "helvetica",
        fontSize: maxCols > 9 ? 7 : 8,
        cellPadding: 1.6,
        overflow: "linebreak",
      },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: CELESTE, textColor: AZUL, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 249, 253] },
      columnStyles: Object.fromEntries(
        colunas.map((c, j) => [
          j,
          { cellWidth: (util * (pesos[j] ?? 14)) / soma, halign: alinhar(c.tipo) },
        ]),
      ),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (r.assinatura) {
    const util = W - 2 * M;
    const txt = doc.splitTextToSize(r.assinatura.texto, util) as string[];
    if (y + txt.length * 4.5 + 30 > H - 14) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(50);
    doc.text(txt, M, y + 4);
    y += txt.length * 4.5 + 22;
    doc.setDrawColor(120);
    doc.line(W / 2 - 45, y, W / 2 + 45, y);
    doc.setFontSize(8.5);
    doc.text(r.assinatura.nome, W / 2, y + 4.5, { align: "center" });
  }

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130);
    doc.text(`${r.empresa} · ${r.titulo} · gerado pelo Corretix (corretix.com.br)`, M, H - 6);
    doc.text(`Página ${p} de ${total}`, W - M, H - 6, { align: "right" });
  }
  return doc.output("blob");
}

export async function baixarPdf(r: Relatorio) {
  baixar(await relatorioPdf(r), `${nomeArquivo(r.arquivo)}.pdf`);
}
