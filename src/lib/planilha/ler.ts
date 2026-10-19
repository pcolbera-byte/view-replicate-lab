// Lê planilhas enviadas pelo usuário (extratos de seguradora) direto no navegador, sem
// bibliotecas: CSV/TXT (separado por ; , ou tabulação) e Excel .xlsx (zip + XML).

export type Tabela = string[][];

// ---------------------------------------------------------------- CSV
function decodificar(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  // Arquivos exportados no Windows costumam vir em Latin-1 (acentos viram \uFFFD).
  if (utf8.includes("\uFFFD")) return new TextDecoder("windows-1252").decode(buf);
  return utf8.replace(/^\uFEFF/, "");
}

export function lerCsv(texto: string): Tabela {
  const amostra = texto.split(/\r?\n/).slice(0, 10).join("\n");
  const conta = (c: string) => amostra.split(c).length - 1;
  const sep = [";", "\t", ","].sort((a, b) => conta(b) - conta(a))[0] ?? ";";
  const linhas: Tabela = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"' && campo === "") aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.map((l) => l.map((c) => c.trim())).filter((l) => l.some((c) => c));
}

// ---------------------------------------------------------------- XLSX
async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([dados as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extrai os arquivos de um zip (formato usado pelo .xlsx). */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let fim = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66_000); i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  if (fim < 0) throw new Error("Arquivo .xlsx inválido ou corrompido.");
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const tamNome = v.getUint16(p + 28, true);
    const tamExtra = v.getUint16(p + 30, true);
    const tamComent = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = dec.decode(bytes.subarray(p + 46, p + 46 + tamNome));
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const dados = bytes.subarray(inicio, inicio + comprimido);
    if (/\.(xml|rels)$/i.test(nome))
      out.set(nome, metodo === 8 ? await inflar(dados) : metodo === 0 ? dados : new Uint8Array());
    p += 46 + tamNome + tamExtra + tamComent;
  }
  return out;
}

function colunaIndice(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function lerXlsx(buf: ArrayBuffer): Promise<Tabela> {
  const arquivos = await unzip(buf);
  const dec = new TextDecoder();
  const xml = (nome: string) => {
    const b = arquivos.get(nome);
    return b ? new DOMParser().parseFromString(dec.decode(b), "application/xml") : null;
  };
  // Primeira planilha do arquivo
  let caminho = "xl/worksheets/sheet1.xml";
  const wb = xml("xl/workbook.xml");
  const rels = xml("xl/_rels/workbook.xml.rels");
  const primeira = wb?.getElementsByTagName("sheet")[0];
  const rid =
    primeira?.getAttribute("r:id") ??
    primeira?.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "id",
    );
  if (rid && rels) {
    for (const r of Array.from(rels.getElementsByTagName("Relationship")))
      if (r.getAttribute("Id") === rid) {
        const alvo = r.getAttribute("Target") ?? "";
        caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, "")}`;
      }
  }
  const compartilhadas: string[] = [];
  const ss = xml("xl/sharedStrings.xml");
  if (ss)
    for (const si of Array.from(ss.getElementsByTagName("si")))
      compartilhadas.push(
        Array.from(si.getElementsByTagName("t"))
          .map((t) => t.textContent ?? "")
          .join(""),
      );
  const planilha = xml(caminho);
  if (!planilha) throw new Error("Não encontrei a planilha dentro do arquivo .xlsx.");
  const tabela: Tabela = [];
  for (const row of Array.from(planilha.getElementsByTagName("row"))) {
    const linha: string[] = [];
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const i = colunaIndice(c.getAttribute("r") ?? "A");
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      const valor =
        t === "s"
          ? (compartilhadas[Number(v)] ?? "")
          : t === "inlineStr"
            ? Array.from(c.getElementsByTagName("t"))
                .map((x) => x.textContent ?? "")
                .join("")
            : v;
      while (linha.length < i) linha.push("");
      linha[i] = valor.trim();
    }
    if (linha.some((x) => x)) tabela.push(linha);
  }
  return tabela;
}

/** Lê .csv, .txt ou .xlsx e devolve as linhas como texto. */
export async function lerPlanilha(file: File): Promise<Tabela> {
  const nome = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  const assinatura = new Uint8Array(buf.slice(0, 4));
  const ehZip = assinatura[0] === 0x50 && assinatura[1] === 0x4b;
  if (nome.endsWith(".xls") && !ehZip)
    throw new Error(
      "Arquivos .xls antigos não são lidos. Abra no Excel e salve como .xlsx ou .csv.",
    );
  if (ehZip || nome.endsWith(".xlsx")) return lerXlsx(buf);
  return lerCsv(decodificar(buf));
}

/** Converte "R$ 1.234,56", "1234.56", "(12,30)" ou "-12,30" em número. */
export function numeroBR(txt: string | null | undefined): number | null {
  if (!txt) return null;
  let s = txt.replace(/R\$|\s|\u00a0/g, "");
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
