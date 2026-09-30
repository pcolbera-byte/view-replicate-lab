// Importação da base do Mais Corret (.mdb do Access) direto pelo navegador.
// Mesmas regras e mesmos identificadores do script scripts/importar-maiscorret/importar.mjs:
// importar pelo app ou pelo script dá o mesmo resultado, e repetir nunca duplica.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------- leitura do .mdb
export type LegacyTables = {
  clientes: any[];
  fones: any[];
  enderecos: any[];
  internet: any[];
  pastas: any[];
  propostas: any[];
  itensauto: any[];
  parcelas: any[];
  comissoes: any[];
  seguradoras: any[];
  produtores: any[];
  tipoEndosso: any[];
  motivos: any[];
  acoes: any[];
};

export async function readMaisCorret(file: File): Promise<LegacyTables> {
  const { Buffer } = await import("buffer-polyfill");
  (globalThis as any).Buffer ??= Buffer;
  const { default: MDBReader } = await import("mdb-reader");
  const reader = new MDBReader(Buffer.from(await file.arrayBuffer()));
  const names = reader.getTableNames();
  if (!names.includes("clientes") || !names.includes("seg_proposta")) {
    throw new Error(
      "Este arquivo não parece ser uma base do Mais Corret (faltam as tabelas de clientes e propostas).",
    );
  }
  const table = (name: string): any[] =>
    names.includes(name) ? reader.getTable(name).getData() : [];
  return {
    clientes: table("clientes"),
    fones: table("telefonecliente"),
    enderecos: table("enderecocliente"),
    internet: table("internetcliente"),
    pastas: table("seg_pastas"),
    propostas: table("seg_proposta"),
    itensauto: table("itensauto"),
    parcelas: table("parcelas"),
    comissoes: table("comissao_parcelas"),
    seguradoras: table("seguradoras"),
    produtores: table("produtores"),
    tipoEndosso: table("tap_tipoendosso"),
    motivos: table("tap_nrenovacao"),
    acoes: table("acao"),
  };
}

// ---------------------------------------------------------------- utilidades
const iso = (v: any): string | null =>
  v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : null;
const txt = (v: any): string => (v == null ? "" : String(v).trim());
const digits = (v: any): string => txt(v).replace(/\D/g, "");
const num = (v: any): number | null =>
  v == null || v === "" || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100;
const title = (s: any): string =>
  txt(s)
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
function phone(v: any): string {
  let d = digits(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return "";
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}
function doc(v: any): string {
  const d = digits(v);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return txt(v);
}
function validCPF(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const c = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return c(9) === Number(d[9]) && c(10) === Number(d[10]);
}
function validCNPJ(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const c = (n: number) => {
    const w =
      n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = w.reduce((a, x, i) => a + Number(d[i]) * x, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return c(12) === Number(d[12]) && c(13) === Number(d[13]);
}
const addDays = (isoDate: string, n: number) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** SHA-1 síncrono (hex) — igual ao crypto.createHash('sha1') do Node. */
function sha1(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const len = bytes.length;
  const words = new Uint32Array((((len + 8) >> 6) + 1) * 16);
  for (let i = 0; i < len; i++)
    words[i >> 2] = (words[i >> 2] ?? 0) | ((bytes[i] ?? 0) << (24 - (i % 4) * 8));
  words[len >> 2] = (words[len >> 2] ?? 0) | (0x80 << (24 - (len % 4) * 8));
  words[words.length - 1] = len * 8;
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[i + t] ?? 0;
    for (let t = 16; t < 80; t++) {
      const x = (w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0);
      w[t] = (x << 1) | (x >>> 31);
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let t = 0; t < 80; t++) {
      const f =
        t < 20
          ? (b & c) | (~b & d)
          : t < 40
            ? b ^ c ^ d
            : t < 60
              ? (b & c) | (b & d) | (c & d)
              : b ^ c ^ d;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + (w[t] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = tmp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, "0")).join("");
}

// ---------------------------------------------------------------- tabelas de apoio
const ESTADO_CIVIL: Record<number, string> = {
  1: "Solteiro(a)",
  2: "Casado(a)",
  3: "Divorciado(a)",
  4: "Divorciado(a)",
  5: "Viúvo(a)",
  7: "União estável",
};
const COMBUSTIVEL: Record<number, string> = {
  1: "Etanol",
  2: "Gasolina",
  3: "Diesel",
  4: "GNV",
  5: "Flex",
  6: "Elétrico",
};
const USO: Record<number, string> = {
  1: "Particular",
  21: "Comercial",
  3: "Táxi",
  2: "Comercial",
  4: "Comercial",
  5: "Outro",
  8: "Outro",
};
const PAGAMENTO: Record<number, string> = {
  1: "Carnê",
  2: "Débito em conta",
  5: "Cartão de crédito",
  6: "Boleto",
};
const RAMO: Record<string, string> = {
  AUTOMÓVEL: "Auto",
  "RASTREADOR + SEGURO": "Auto",
  RESIDÊNCIA: "Residencial",
  EMPRESA: "Empresarial",
  CONDOMÍNIO: "Condomínio",
  VIDA: "Vida",
  SAÚDE: "Saúde",
  "PREVIDÊNCIA PRIVADA": "Previdência",
  "RESPONSABILIDADE CIVIL": "Responsabilidade civil",
  "RD EQUIPAMENTOS": "Equipamentos",
  "EQUIPAMENTOS PORTATEIS": "Equipamentos",
  "RISCOS DE ENGENHARIA": "Riscos de engenharia",
  ALUGUEL: "Fiança locatícia",
  VIAGEM: "Viagem",
  "ASSISTÊNCIA FUNERAL": "Funeral",
  CAPITALIZAÇÃO: "Capitalização",
  CELULAR: "Celular",
};
const MARCAS: Record<string, string[]> = {
  Volkswagen: [
    "gol",
    "fox",
    "polo",
    "voyage",
    "saveiro",
    "up",
    "golf",
    "jetta",
    "virtus",
    "nivus",
    "t-cross",
    "tcross",
    "amarok",
    "taos",
    "tiguan",
    "crossfox",
    "spacefox",
    "parati",
    "kombi",
    "delivery",
    "constellation",
    "passat",
    "santana",
    "quantum",
    "bora",
  ],
  Chevrolet: [
    "onix",
    "prisma",
    "celta",
    "corsa",
    "classic",
    "agile",
    "montana",
    "spin",
    "cobalt",
    "cruze",
    "tracker",
    "s10",
    "trailblazer",
    "astra",
    "vectra",
    "meriva",
    "zafira",
    "captiva",
    "equinox",
    "blazer",
    "kadett",
    "monza",
  ],
  Fiat: [
    "uno",
    "palio",
    "siena",
    "strada",
    "mobi",
    "argo",
    "cronos",
    "toro",
    "idea",
    "punto",
    "doblo",
    "fiorino",
    "grand siena",
    "weekend",
    "linea",
    "bravo",
    "stilo",
    "pulse",
    "fastback",
    "ducato",
    "freemont",
    "tempra",
    "marea",
  ],
  Ford: [
    "ka",
    "fiesta",
    "focus",
    "ecosport",
    "ranger",
    "fusion",
    "courier",
    "territory",
    "maverick",
    "escort",
    "edge",
    "transit",
  ],
  Renault: [
    "sandero",
    "logan",
    "kwid",
    "duster",
    "captur",
    "clio",
    "megane",
    "symbol",
    "oroch",
    "fluence",
    "master",
    "scenic",
    "kangoo",
  ],
  Toyota: ["corolla", "etios", "yaris", "hilux", "sw4", "rav4", "camry", "prius", "bandeirante"],
  Honda: [
    "civic",
    "fit",
    "city",
    "hr-v",
    "hrv",
    "wr-v",
    "wrv",
    "cr-v",
    "crv",
    "accord",
    "biz",
    "cg",
    "fan",
    "titan",
    "pop",
    "bros",
    "xre",
    "cb",
    "nxr",
    "pcx",
    "lead",
    "elite",
    "twister",
    "cbr",
    "sahara",
    "falcon",
  ],
  Hyundai: [
    "sonata",
    "veracruz",
    "hb20",
    "creta",
    "tucson",
    "ix35",
    "santa fe",
    "azera",
    "elantra",
    "i30",
    "hr",
    "veloster",
  ],
  Nissan: ["march", "versa", "sentra", "kicks", "frontier", "livina", "tiida"],
  Iveco: ["daily", "tector", "stralis"],
  Jeep: ["renegade", "compass", "commander", "wrangler", "cherokee"],
  Peugeot: ["206", "207", "208", "2008", "3008", "307", "308", "408", "partner", "boxer", "hoggar"],
  Citroën: ["c3", "c4", "aircross", "xsara", "picasso", "berlingo", "jumper", "cactus"],
  Mitsubishi: ["l200", "pajero", "asx", "outlander", "lancer", "eclipse"],
  Yamaha: [
    "factor",
    "fazer",
    "ybr",
    "lander",
    "nmax",
    "crosser",
    "xtz",
    "tenere",
    "neo",
    "mt-03",
    "r3",
  ],
  Kia: ["picanto", "cerato", "sportage", "sorento", "soul", "bongo"],
  "Caoa Chery": ["tiggo", "arrizo", "qq", "celer"],
  Suzuki: ["jimny", "vitara", "swift", "intruder", "yes", "burgman"],
};
const MARCA_NOMES = Object.keys(MARCAS).concat([
  "GM",
  "VW",
  "Mercedes-Benz",
  "Mercedes",
  "BMW",
  "Audi",
  "Volvo",
  "Iveco",
  "Scania",
  "Land Rover",
  "Dafra",
  "Shineray",
  "Kawasaki",
  "Harley-Davidson",
  "Troller",
  "BYD",
  "GWM",
  "JAC",
  "Lifan",
  "Chery",
]);
const ALIAS: Record<string, string> = {
  citroen: "Citroën",
  mitsubishy: "Mitsubishi",
  "mercedes benz": "Mercedes-Benz",
  gm: "Chevrolet",
  vw: "Volkswagen",
  mercedes: "Mercedes-Benz",
  "m.benz": "Mercedes-Benz",
  mb: "Mercedes-Benz",
  chery: "Caoa Chery",
};
const BRAND_KEYS = [...MARCA_NOMES, ...Object.keys(ALIAS)].sort((a, b) => b.length - a.length);
function splitBrand(descr: any): { marca: string; modelo: string } {
  const d = txt(descr).replace(/\s+/g, " ");
  const low = d.toLowerCase();
  for (const b of BRAND_KEYS) {
    const bl = b.toLowerCase();
    if (
      low === bl ||
      low.startsWith(`${bl} `) ||
      low.startsWith(`${bl}-`) ||
      low.startsWith(`${bl}/`)
    ) {
      return {
        marca: ALIAS[bl] ?? (b === b.toUpperCase() ? b : title(b)),
        modelo: title(d.slice(b.length).replace(/^[\s\-/]+/, "")),
      };
    }
  }
  const first = low.split(/[\s.]+/)[0] ?? "";
  const two = low.split(/\s+/).slice(0, 2).join(" ");
  for (const [marca, modelos] of Object.entries(MARCAS))
    if (modelos.includes(first) || modelos.includes(two)) return { marca, modelo: title(d) };
  return { marca: "", modelo: title(d) };
}

// ---------------------------------------------------------------- transformação
export type ImportRows = {
  seguradoras: any[];
  clientes: any[];
  veiculos: any[];
  apolices: any[];
  parcelas: any[];
  comissoes: any[];
  historico_contatos: any[];
};
export type ImportPlan = {
  rows: ImportRows;
  vigentes: number;
  avisos: string[];
  ignorados: [string, number][];
};

export function buildImport(
  T: LegacyTables,
  opts: { empresaId: string; adminId: string; existentes: Map<string, string>; today?: string },
): ImportPlan {
  const TODAY = opts.today ?? new Date().toISOString().slice(0, 10);
  const NOW = new Date().toISOString();
  const adminId = opts.adminId;
  const uid = (kind: string, key: unknown) => {
    const h = sha1(`maiscorret:${opts.empresaId}:${kind}:${String(key)}`);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16] ?? "0", 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  const avisos: string[] = [];
  const ignorados = new Map<string, number>();
  const skip = (what: string, why: string) => {
    const k = `${what}: ${why}`;
    ignorados.set(k, (ignorados.get(k) ?? 0) + 1);
  };

  const segByCode = new Map(T.seguradoras.map((s) => [s.codseg, s]));
  const segTitle = (s: any) =>
    title(s)
      .replace(/\b(\p{L}{2,3})\b/gu, (w) =>
        /^(de|da|do|e)$/i.test(w) ? w.toLowerCase() : w.toUpperCase(),
      )
      .replace(/\bItau\b/i, "Itaú")
      .replace(/\bSul America\b/i, "SulAmérica");
  const segName = (code: any) =>
    segTitle(segByCode.get(code)?.descricao) ||
    (code ? `Seguradora cód. ${code}` : "Não informada");
  const prodName = new Map(T.produtores.map((p) => [p.codprod, title(p.nome)]));
  const endossoTipo = new Map(
    T.tipoEndosso.map((t) => [t.codtipoendosso, title(t.descricaotipoendosso)]),
  );
  const motivo = new Map(T.motivos.map((m) => [m.codigo, title(m.descricao)]));
  const pastaById = new Map(T.pastas.map((p) => [p.chavepasta, p]));
  const group = <K>(rows: any[], key: (r: any) => K) => {
    const m = new Map<K, any[]>();
    for (const r of rows) {
      const k = key(r);
      const l = m.get(k);
      if (l) l.push(r);
      else m.set(k, [r]);
    }
    return m;
  };
  const fonesBy = group(T.fones, (f) => f.codcli);
  const netBy = group(T.internet, (i) => i.codcli);
  const endBy = group(T.enderecos, (e) => e.codcli);
  const parcBy = group(T.parcelas, (p) => p.chaveproposta);

  const rows: ImportRows = {
    seguradoras: [],
    clientes: [],
    veiculos: [],
    apolices: [],
    parcelas: [],
    comissoes: [],
    historico_contatos: [],
  };

  // Seguradoras
  const segNames = new Set([
    ...T.seguradoras.map((s) => segName(s.codseg)),
    ...T.propostas.map((p) => segName(p.nomeseguradora)),
  ]);
  const segId = new Map<string, string>();
  for (const nome of segNames) {
    const s = T.seguradoras.find((x) => segName(x.codseg) === nome);
    const ja = opts.existentes.get(nome.toLowerCase());
    const id = ja ?? uid("seguradora", nome);
    segId.set(nome, id);
    if (!ja) rows.seguradoras.push({ id, nome, cnpj: doc(s?.cnpj), ativo: true });
  }

  // Clientes
  const cliId = new Map<any, string>();
  let docInvalido = 0;
  for (const c of T.clientes) {
    const pj = c.pessoa === 2;
    const docRaw = pj ? c.cnpj || c.cpf : c.cpf || c.cnpj;
    const d = digits(docRaw);
    if (d && !(d.length === 11 ? validCPF(d) : d.length === 14 ? validCNPJ(d) : false))
      docInvalido++;
    const fones = (fonesBy.get(c.codcli) ?? [])
      .map((f) => ({ tipo: f.codtipotelefone, n: phone(f.telefone) }))
      .filter((f) => f.n);
    const cel = fones.find((f) => f.tipo === 3) ?? fones.find((f) => digits(f.n).length === 11);
    const fixo = fones.find((f) => f !== cel);
    const email =
      (netBy.get(c.codcli) ?? [])
        .filter((i) => i.codtipointernet === 1 || /@/.test(txt(i.internet)))
        .map((i) => txt(i.internet).toLowerCase())
        .find((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) ?? "";
    const end = [...(endBy.get(c.codcli) ?? [])].sort(
      (a, b) => (b.padrao ?? 0) - (a.padrao ?? 0),
    )[0];
    const obs = [
      `Importado do Mais Corret (cód. ${c.codcli}).`,
      c.produtor && prodName.get(c.produtor) ? `Produtor: ${prodName.get(c.produtor)}.` : "",
      txt(c.numerocnh)
        ? `CNH ${txt(c.numerocnh)}${iso(c.validadecnh) ? ` (validade ${iso(c.validadecnh)})` : ""}.`
        : "",
      txt(c.obs),
    ]
      .filter(Boolean)
      .join(" ");
    const id = uid("cliente", c.codcli);
    cliId.set(c.codcli, id);
    const cepD = end ? digits(end.cep) : "";
    rows.clientes.push({
      id,
      tipo: pj ? "PJ" : "PF",
      nome: title(c.nome) || `Cliente ${c.codcli}`,
      documento: doc(docRaw),
      rg: c.tipodoc === 1 ? txt(c.numdoc) : "",
      data_nascimento: pj ? null : iso(c.nascimento),
      estado_civil: ESTADO_CIVIL[c.ecivil] ?? "",
      responsavel_nome: pj ? title(c.contato) : "",
      whatsapp: cel?.n ?? "",
      telefone: fixo?.n ?? "",
      email,
      cep: cepD.length === 8 ? `${cepD.slice(0, 5)}-${cepD.slice(5)}` : "",
      endereco: end ? title(`${txt(end.tipologradouro)} ${txt(end.logradouro)}`) : "",
      numero: end ? txt(end.numero) : "",
      complemento: end ? title(end.complemento) : "",
      bairro: end ? title(end.bairro) : "",
      cidade: end ? title(end.cidade) : "",
      estado: end ? txt(end.estado).toUpperCase().slice(0, 2) : "",
      observacoes: obs,
      responsavel_id: adminId,
      created_at: iso(c.datacadastro) ? `${iso(c.datacadastro)}T12:00:00Z` : NOW,
    });
  }
  if (docInvalido)
    avisos.push(
      `${docInvalido} cliente(s) com CPF/CNPJ inválido — importados assim mesmo; revise na ficha.`,
    );

  // Propostas
  const clienteDaProposta = (p: any) => cliId.get(pastaById.get(p.chavepasta)?.codcli);
  const principais: any[] = [],
    endossos: any[] = [],
    cancelamentos: any[] = [];
  for (const p of T.propostas) {
    if (!clienteDaProposta(p)) {
      skip("proposta", "sem cliente vinculado");
      continue;
    }
    if (p.tipoproposta === 2) endossos.push(p);
    else if (p.tipoproposta === 4) cancelamentos.push(p);
    else if (!iso(p.dtiniciovig) || !iso(p.dtfinalvig)) skip("apólice", "sem datas de vigência");
    else principais.push(p);
  }

  // Veículos
  const propostaById = new Map(T.propostas.map((p) => [p.chaveproposta, p]));
  const veicKey = new Map<string, any>();
  const veicDaProposta = new Map<any, string[]>();
  const itens = T.itensauto
    .filter((i) => txt(i.placa) || txt(i.chassi) || txt(i.descr))
    .map((i) => ({ i, p: propostaById.get(i.chaveproposta) }))
    .filter((x) => x.p && clienteDaProposta(x.p))
    .sort((a, b) => (iso(a.p.dtiniciovig) ?? "").localeCompare(iso(b.p.dtiniciovig) ?? ""));
  for (const { i, p } of itens) {
    const cliente = clienteDaProposta(p);
    const placa = txt(i.placa)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
    const key = `${cliente}|${placa || digits(i.chassi) || txt(i.chassi).toUpperCase() || `${txt(i.descr).toUpperCase()}|${i.anomod ?? ""}`}`;
    const id = uid("veiculo", key);
    const b = splitBrand(i.descr);
    veicKey.set(key, {
      id,
      cliente_id: cliente,
      placa,
      marca: b.marca,
      modelo: b.modelo || "Veículo",
      ano_fabricacao: i.anofab || null,
      ano_modelo: i.anomod || null,
      ano: i.anomod || null,
      chassi: txt(i.chassi).toUpperCase(),
      renavam: digits(i.renavam),
      combustivel: COMBUSTIVEL[i.combustivel] ?? "",
      uso: USO[i.uso] ?? (i.uso ? "Outro" : ""),
      tipo: "Automóvel",
      observacoes: "Importado do Mais Corret.",
    });
    const list = veicDaProposta.get(p.chaveproposta) ?? [];
    if (!list.includes(id)) list.push(id);
    veicDaProposta.set(p.chaveproposta, list);
  }
  rows.veiculos = [...veicKey.values()];
  const semPlaca = rows.veiculos.filter((v) => !v.placa).length;
  if (semPlaca)
    avisos.push(
      `${semPlaca} veículo(s) sem placa no sistema antigo (identificados pelo chassi ou modelo) — complete a placa ao editar.`,
    );

  // Apólices
  const apoliceId = (p: any) => uid("apolice", p.chaveproposta);
  const porPasta = new Map<any, any[]>();
  for (const p of principais)
    porPasta.set(p.chavepasta, [...(porPasta.get(p.chavepasta) ?? []), p]);
  const canceladas = new Set<any>();
  for (const c of cancelamentos) {
    const data = iso(c.dtiniciovig) ?? iso(c.dtemissao);
    const alvo = (porPasta.get(c.chavepasta) ?? []).find(
      (p) => data && (iso(p.dtiniciovig) ?? "") <= data && data <= (iso(p.dtfinalvig) ?? ""),
    );
    if (alvo) canceladas.add(alvo.chaveproposta);
    else skip("cancelamento", "sem apólice correspondente");
  }
  let encerradasSemRegistro = 0;
  for (const [pasta, lista] of porPasta) {
    lista.sort(
      (a, b) =>
        (iso(a.dtiniciovig) ?? "").localeCompare(iso(b.dtiniciovig) ?? "") ||
        a.chaveproposta - b.chaveproposta,
    );
    lista.forEach((p, idx) => {
      const pastaRow = pastaById.get(pasta);
      const prev = idx > 0 ? lista[idx - 1] : null;
      const anterior =
        prev && !canceladas.has(prev.chaveproposta) && prev.status !== 4 ? prev : null;
      const fim = iso(p.dtfinalvig) ?? "";
      let status = "Vigente",
        renovacao_status = "Pendente",
        renovacao_obs = "";
      if (canceladas.has(p.chaveproposta)) {
        status = "Cancelada";
        renovacao_status = "Não renovada";
        renovacao_obs = "Cancelada no sistema anterior.";
      } else if (p.status === 4) {
        status = "Encerrada";
        renovacao_status = "Não renovada";
        renovacao_obs = motivo.get(p.motivonaorenovar) ?? "Não renovada (sistema anterior).";
      } else if (p.status === 2 || idx < lista.length - 1) {
        status = "Renovada";
        renovacao_status = "Renovada";
      } else if (fim < addDays(TODAY, -60)) {
        status = "Encerrada";
        renovacao_status = "Não renovada";
        renovacao_obs = "Vencida sem renovação registrada no sistema anterior.";
        encerradasSemRegistro++;
      }
      const veics = veicDaProposta.get(p.chaveproposta) ?? [];
      const parc1 = parcBy.get(p.chaveproposta)?.[0];
      const qtd = Number(p.qtdparcelasseguro) || null;
      const seguradora = segName(p.nomeseguradora);
      rows.apolices.push({
        id: apoliceId(p),
        cliente_id: clienteDaProposta(p),
        veiculo_id: veics[0] ?? null,
        ramo:
          RAMO[txt(pastaRow?.nomeramo).toUpperCase()] ?? (title(pastaRow?.nomeramo) || "Outros"),
        seguradora,
        seguradora_id: segId.get(seguradora) ?? null,
        numero: txt(p.napolice) || txt(p.nproposta) || `MC-${p.chaveproposta}`,
        inicio: iso(p.dtiniciovig),
        vencimento: fim,
        premio: num(p.premiototal) ?? num(p.premioliquido) ?? 0,
        comissao_percentual: num(p.comissaotrab),
        forma_pagamento: PAGAMENTO[parc1?.formapag] ?? "",
        parcelas_qtd: qtd && qtd >= 1 && qtd <= 24 ? qtd : null,
        status,
        renovacao_status,
        renovacao_obs,
        apolice_anterior_id: anterior ? apoliceId(anterior) : null,
        responsavel_id: adminId,
        observacoes: [
          `Importado do Mais Corret (proposta ${p.chaveproposta}${txt(p.nproposta) ? `, nº proposta ${txt(p.nproposta)}` : ""}).`,
          p.tipoproposta === 3 ? "Renovação." : "Seguro novo.",
          prodName.get(p.nomeprodutor) ? `Produtor: ${prodName.get(p.nomeprodutor)}.` : "",
          veics.length > 1 ? `${veics.length} itens (frota).` : "",
          txt(p.obs),
        ]
          .filter(Boolean)
          .join(" "),
        created_at: iso(p.dtemissao) ? `${iso(p.dtemissao)}T12:00:00Z` : NOW,
        _geracao: idx,
      });
    });
  }
  if (encerradasSemRegistro)
    avisos.push(
      `${encerradasSemRegistro} apólice(s) venceram há mais de 60 dias sem renovação registrada no sistema antigo — importadas como "Encerrada".`,
    );
  const vigentes = new Set(
    rows.apolices.filter((a) => a.status === "Vigente" && a.vencimento >= TODAY).map((a) => a.id),
  );

  // Parcelas e comissões (só a vencer, das vigentes)
  const byApolice = new Map(rows.apolices.map((a) => [a.id, a]));
  const seenParc = new Set<string>();
  for (const x of T.parcelas) {
    const aid = uid("apolice", x.chaveproposta);
    if (!vigentes.has(aid)) continue;
    const venc = iso(x.vencimento);
    if (!venc || venc < TODAY) {
      skip("parcela de apólice vigente", "já vencida (pagamento não registrado no sistema antigo)");
      continue;
    }
    const n = Number(x.nparcela) || 0;
    const k = `${aid}|${n}`;
    if (n < 1 || seenParc.has(k)) {
      skip("parcela", "número repetido ou inválido");
      continue;
    }
    seenParc.add(k);
    rows.parcelas.push({
      id: uid("parcela", x.chaveparcela),
      apolice_id: aid,
      numero: n,
      vencimento: venc,
      valor: num(x.valor) ?? 0,
      status: "Pendente",
      observacoes: "Importada do Mais Corret.",
    });
  }
  for (const x of T.comissoes) {
    const aid = uid("apolice", x.chaveproposta);
    if (!vigentes.has(aid)) continue;
    const data = iso(x.data);
    if (!data || data < TODAY) {
      skip(
        "comissão de apólice vigente",
        "data prevista já passou (recebimento não registrado no sistema antigo)",
      );
      continue;
    }
    if (x.status === 2) {
      skip("comissão", "cancelada");
      continue;
    }
    const a = byApolice.get(aid);
    rows.comissoes.push({
      id: uid("comissao", x.chavecomissao),
      apolice_id: aid,
      parcela: Number(x.nparcela) || null,
      percentual: a?.comissao_percentual ?? null,
      valor: num(x.valor) ?? 0,
      data_prevista: data,
      status: x.status === 1 ? "Recebida" : "Prevista",
      data_recebida: x.status === 1 ? iso(x.dtrecebimento) : null,
      responsavel_id: adminId,
      observacoes: "Importada do Mais Corret.",
    });
  }

  // Histórico
  const apoliceNaData = (pasta: any, data: string | null) =>
    (porPasta.get(pasta) ?? []).find(
      (p) => data && (iso(p.dtiniciovig) ?? "") <= data && data <= (iso(p.dtfinalvig) ?? ""),
    );
  for (const e of endossos) {
    const data = iso(e.dtemissao) ?? iso(e.dtiniciovig) ?? TODAY;
    const alvo = apoliceNaData(e.chavepasta, iso(e.dtiniciovig) ?? data);
    const tipoE = endossoTipo.get(Number(e.tipoendosso));
    const premio = num(e.premiototal);
    rows.historico_contatos.push({
      id: uid("endosso", e.chaveproposta),
      cliente_id: clienteDaProposta(e),
      apolice_id: alvo ? apoliceId(alvo) : null,
      tipo: "Outro",
      data,
      descricao: `Endosso${tipoE ? `: ${tipoE}` : ""} — ${segName(e.nomeseguradora)}${txt(e.nendosso) ? ` nº ${txt(e.nendosso)}` : ""}${premio ? `, prêmio ${premio.toFixed(2).replace(".", ",")}` : ""}. (Importado do Mais Corret.)`,
      usuario_id: adminId,
    });
  }
  for (const a of T.acoes) {
    const cliente = cliId.get(a.codcli);
    const texto = [txt(a.assunto), txt(a.msn)].filter(Boolean).join(" — ");
    if (!cliente || !texto) {
      skip("ação/agenda", "sem cliente ou sem texto");
      continue;
    }
    const p = a.cod_proposta ? propostaById.get(a.cod_proposta) : null;
    rows.historico_contatos.push({
      id: uid("acao", a.cod_acao),
      cliente_id: cliente,
      apolice_id:
        p && (p.tipoproposta === 1 || p.tipoproposta === 3) && byApolice.has(apoliceId(p))
          ? apoliceId(p)
          : null,
      tipo: "Outro",
      data: iso(a.data_envio) ?? iso(a.data_agenda) ?? TODAY,
      descricao: `${texto} (Importado do Mais Corret.)`,
      usuario_id: adminId,
    });
  }

  return { rows, vigentes: vigentes.size, avisos, ignorados: [...ignorados.entries()] };
}

// ---------------------------------------------------------------- envio
export const IMPORT_STEPS: { key: keyof ImportRows; label: string }[] = [
  { key: "seguradoras", label: "Seguradoras" },
  { key: "clientes", label: "Clientes" },
  { key: "veiculos", label: "Veículos" },
  { key: "apolices", label: "Apólices" },
  { key: "parcelas", label: "Parcelas" },
  { key: "comissoes", label: "Comissões" },
  { key: "historico_contatos", label: "Histórico" },
];

export type ImportProgress = {
  step: keyof ImportRows;
  done: number;
  total: number;
  errors: string[];
};

function explain(tabela: string, message: string): string {
  if (tabela === "apolices" && /row-level security/i.test(message)) {
    return "O banco recusou apólices renovadas. Aplique no Lovable a migração 20260930120000_complementos_gestao.sql e importe de novo (o que já entrou não duplica).";
  }
  if (/row-level security|foreign key/i.test(message)) {
    return "Parte das parcelas, comissões e anotações ficou de fora porque as apólices ligadas a elas não foram gravadas. Elas entram ao importar de novo.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "A conexão caiu durante a importação. Importe de novo: o que já entrou não duplica.";
  }
  return message;
}

/** Envia em lotes; registros já existentes (mesmo id) são ignorados. */
export async function sendImport(
  plan: ImportPlan,
  empresaId: string,
  onProgress: (p: ImportProgress) => void,
): Promise<string[]> {
  const errors: string[] = [];
  const BATCH = 300;
  for (const { key } of IMPORT_STEPS) {
    const all = plan.rows[key].map((r) => {
      const o: Record<string, unknown> = { empresa_id: empresaId };
      for (const [k, v] of Object.entries(r))
        if (!k.startsWith("_")) o[k] = v === undefined ? null : v;
      return o;
    });
    // Apólices em "gerações": cada renovação só entra depois da anterior (a regra do banco confere o vínculo).
    const groups: Record<string, unknown>[][] =
      key === "apolices"
        ? (() => {
            const max = Math.max(0, ...plan.rows.apolices.map((a) => a._geracao as number));
            return Array.from({ length: max + 1 }, (_, g) =>
              all.filter((_r, i) => plan.rows.apolices[i]._geracao === g),
            );
          })()
        : [all];
    let done = 0;
    onProgress({ step: key, done, total: all.length, errors });
    for (const grupo of groups) {
      for (let i = 0; i < grupo.length; i += BATCH) {
        const lote = grupo.slice(i, i + BATCH);
        const { error } = await supabase
          .from(key as "clientes")
          .upsert(lote as never, { onConflict: "id", ignoreDuplicates: true });
        if (error) {
          const msg = explain(key, error.message);
          if (!errors.includes(msg)) errors.push(msg);
          if (errors.length > 20) throw new Error(errors.join("\n"));
        }
        done += lote.length;
        onProgress({ step: key, done, total: all.length, errors });
      }
    }
  }
  return errors;
}
