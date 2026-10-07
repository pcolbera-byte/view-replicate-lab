// Cópia de segurança da corretora: arquivo completo (.json, para restaurar) e planilha (.xlsx).
import { supabase } from "@/integrations/supabase/client";
import type { Workspace } from "@/lib/data/workspace";
import { gerarXlsx, type Planilha } from "./xlsx";

/** Tabelas da corretora, na ordem em que precisam ser restauradas. */
export const TABELAS = [
  ["seguradoras", "Seguradoras"],
  ["produtores", "Produtores"],
  ["clientes", "Clientes"],
  ["leads", "Leads"],
  ["veiculos", "Veículos"],
  ["condutores", "Condutores"],
  ["apolices", "Apólices"],
  ["apolice_rateio", "Rateio"],
  ["parcelas", "Parcelas"],
  ["comissoes", "Comissões"],
  ["tarefas", "Tarefas"],
  ["historico_contatos", "Histórico"],
  ["sinistros", "Sinistros"],
  ["documentos", "Documentos"],
  ["mensagens", "Mensagens"],
] as const;
export type TabelaBackup = (typeof TABELAS)[number][0];

export type Backup = {
  app: "corretix";
  versao: 1;
  empresa_id: string;
  empresa_nome: string;
  gerado_em: string;
  gerado_por: string;
  tabelas: Partial<Record<TabelaBackup, Record<string, unknown>[]>>;
};

export function montarBackup(ws: Workspace): Backup {
  const tabelas: Backup["tabelas"] = {};
  for (const [t] of TABELAS) {
    const linhas = (ws as unknown as Record<string, unknown>)[t];
    if (Array.isArray(linhas)) tabelas[t] = linhas as Record<string, unknown>[];
  }
  return {
    app: "corretix",
    versao: 1,
    empresa_id: ws.empresa.id,
    empresa_nome: ws.empresa.nome,
    gerado_em: new Date().toISOString(),
    gerado_por: ws.email,
    tabelas,
  };
}

const nomeArquivo = (ws: Workspace, ext: string) => {
  const slug = ws.empresa.nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `backup-corretix-${slug || "corretora"}-${new Date().toISOString().slice(0, 10)}.${ext}`;
};

export function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function baixarJson(ws: Workspace) {
  const b = montarBackup(ws);
  baixar(new Blob([JSON.stringify(b)], { type: "application/json" }), nomeArquivo(ws, "json"));
  return b;
}

// Colunas técnicas que não interessam na planilha.
const OCULTAS = new Set(["empresa_id", "is_demo", "caminho"]);

export function baixarPlanilha(ws: Workspace) {
  const b = montarBackup(ws);
  const nomes = new Map<string, string>();
  for (const c of ws.clientes) nomes.set(c.id, c.nome);
  const planilhas: Planilha[] = [];
  for (const [t, rotulo] of TABELAS) {
    const linhas = b.tabelas[t] ?? [];
    if (!linhas.length) continue;
    const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))].filter(
      (c) => !OCULTAS.has(c),
    );
    // Nome do cliente ao lado do id, para a planilha ser legível.
    const comCliente = colunas.includes("cliente_id") && t !== "clientes";
    const cab = comCliente ? ["cliente", ...colunas] : colunas;
    planilhas.push({
      nome: rotulo,
      linhas: [
        cab,
        ...linhas.map((l) => {
          const vals = colunas.map((c) => {
            const v = l[c];
            return v !== null && typeof v === "object"
              ? JSON.stringify(v)
              : (v as string | number | boolean | null);
          });
          return comCliente ? [nomes.get(String(l["cliente_id"])) ?? "", ...vals] : vals;
        }),
      ],
    });
  }
  baixar(gerarXlsx(planilhas), nomeArquivo(ws, "xlsx"));
}

// ---------- restauração ----------
export type AnaliseRestauracao = {
  backup: Backup;
  porTabela: { tabela: TabelaBackup; rotulo: string; total: number; faltando: number }[];
  faltando: number;
};

export async function lerBackup(file: File, ws: Workspace): Promise<AnaliseRestauracao> {
  let b: Backup;
  try {
    b = JSON.parse(await file.text()) as Backup;
  } catch {
    throw new Error("Arquivo inválido. Escolha o arquivo .json gerado pelo backup do Corretix.");
  }
  if (b?.app !== "corretix" || !b.tabelas)
    throw new Error("Este arquivo não é um backup do Corretix.");
  if (b.empresa_id !== ws.empresa.id)
    throw new Error(
      `Este backup é de outra corretora (${b.empresa_nome}). Só é possível restaurar o backup da própria corretora.`,
    );
  const porTabela = TABELAS.map(([t, rotulo]) => {
    const linhas = b.tabelas[t] ?? [];
    const atuais = new Set(
      ((ws as unknown as Record<string, { id: string }[] | undefined>)[t] ?? []).map((r) => r.id),
    );
    return {
      tabela: t,
      rotulo,
      total: linhas.length,
      faltando: linhas.filter((l) => !atuais.has(String(l["id"]))).length,
    };
  });
  return { backup: b, porTabela, faltando: porTabela.reduce((s, x) => s + x.faltando, 0) };
}

/** Apólices renovadas depois das anteriores (o banco confere o vínculo). */
function ordenarApolices(linhas: Record<string, unknown>[]) {
  const porId = new Map(linhas.map((l) => [String(l["id"]), l]));
  const nivel = new Map<string, number>();
  const calc = (id: string, guarda = 0): number => {
    if (nivel.has(id)) return nivel.get(id) ?? 0;
    const ant = porId.get(id)?.["apolice_anterior_id"];
    const n = ant && porId.has(String(ant)) && guarda < 200 ? calc(String(ant), guarda + 1) + 1 : 0;
    nivel.set(id, n);
    return n;
  };
  return [...linhas].sort((a, b) => calc(String(a["id"])) - calc(String(b["id"])));
}

/** Recria o que foi apagado. O que já existe não é alterado. */
export async function restaurar(
  a: AnaliseRestauracao,
  empresaId: string,
  progresso: (feito: number, total: number) => void,
): Promise<string[]> {
  const erros: string[] = [];
  let feito = 0;
  for (const { tabela, total } of a.porTabela) {
    let linhas: Record<string, unknown>[] = (a.backup.tabelas[tabela] ?? []).map((l) => ({
      ...l,
      empresa_id: empresaId,
    }));
    if (tabela === "apolices") linhas = ordenarApolices(linhas);
    for (let i = 0; i < linhas.length; i += 200) {
      const lote = linhas.slice(i, i + 200);
      const { error } = await supabase
        .from(tabela as "clientes")
        .upsert(lote as never, { onConflict: "id", ignoreDuplicates: true });
      if (error && !erros.includes(error.message)) erros.push(`${tabela}: ${error.message}`);
      feito += lote.length;
      progresso(
        feito,
        a.porTabela.reduce((s, x) => s + x.total, 0),
      );
    }
    void total;
  }
  return erros;
}
