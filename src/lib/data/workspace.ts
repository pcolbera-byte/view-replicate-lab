// Camada de acesso a dados: tudo que fala com o Supabase passa por aqui.
// O isolamento por corretora é garantido no banco (RLS); aqui só enviamos empresa_id nos inserts.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  Apolice,
  ApoliceRateio,
  Atividade,
  Cliente,
  Comissao,
  Condutor,
  Contato,
  DataTable,
  Documento,
  Empresa,
  FormTable,
  FormValues,
  Lead,
  Mensagem,
  Parcela,
  Produtor,
  Profile,
  Seguradora,
  Sinistro,
  Tarefa,
  UserRole,
  Veiculo,
} from "./types";

export type Workspace = {
  userId: string;
  email: string;
  profile: Profile;
  empresa: Empresa;
  isAdmin: boolean;
  clientes: Cliente[];
  leads: Lead[];
  veiculos: Veiculo[];
  condutores: Condutor[];
  seguradoras: Seguradora[];
  apolices: Apolice[];
  parcelas: Parcela[];
  comissoes: Comissao[];
  tarefas: Tarefa[];
  historico_contatos: Contato[];
  sinistros: Sinistro[];
  documentos: Documento[];
  mensagens: Mensagem[];
  atividades: Atividade[];
  profiles: Profile[];
  user_roles: UserRole[];
  produtores: Produtor[];
  apolice_rateio: ApoliceRateio[];
  /** false quando a migração de produtores ainda não foi aplicada no banco. */
  temProdutores: boolean;
};

const PAGE = 1000;

/** Busca todas as linhas (o PostgREST limita a 1000 por requisição). */
async function fetchAll<T>(
  table: DataTable,
  order = "created_at",
  ascending = false,
  limit?: number,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = limit ? Math.min(from + PAGE, limit) - 1 : from + PAGE - 1;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending })
      .range(from, to);
    if (error) throw new Error(`Falha ao carregar ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE || (limit && rows.length >= limit)) break;
  }
  return rows;
}

/** Tabela que depende de uma migração mais nova: se ainda não existir no banco, devolve null
 * em vez de derrubar o app inteiro. */
async function fetchOptional<T>(
  table: DataTable,
  order = "created_at",
  ascending = true,
): Promise<T[] | null> {
  try {
    return await fetchAll<T>(table, order, ascending);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/does not exist|could not find the table|schema cache|PGRST205|42P01/i.test(msg))
      return null;
    throw e;
  }
}

export async function loadWorkspace(): Promise<Workspace> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sua sessão terminou. Entre novamente.");
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!profile) throw new Error("Seu usuário ainda não está vinculado a uma corretora.");
  if (!profile.ativo) throw new Error("Seu acesso foi desativado pelo administrador da corretora.");
  const { data: empresa, error: eErr } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", profile.empresa_id)
    .single();
  if (eErr || !empresa) throw new Error("Não foi possível carregar sua corretora.");

  const [
    clientes,
    leads,
    veiculos,
    condutores,
    seguradoras,
    apolices,
    parcelas,
    comissoes,
    tarefas,
    historico,
    sinistros,
    documentos,
    mensagens,
    atividades,
    profiles,
    roles,
    produtores,
    rateio,
  ] = await Promise.all([
    fetchAll<Cliente>("clientes"),
    fetchAll<Lead>("leads"),
    fetchAll<Veiculo>("veiculos"),
    fetchAll<Condutor>("condutores", "created_at", true),
    fetchAll<Seguradora>("seguradoras", "nome", true),
    fetchAll<Apolice>("apolices"),
    fetchAll<Parcela>("parcelas", "vencimento", true),
    fetchAll<Comissao>("comissoes", "data_prevista", true),
    fetchAll<Tarefa>("tarefas", "data", true),
    fetchAll<Contato>("historico_contatos"),
    fetchAll<Sinistro>("sinistros"),
    fetchAll<Documento>("documentos"),
    fetchAll<Mensagem>("mensagens", "created_at", true),
    fetchAll<Atividade>("atividades", "created_at", false, 200),
    fetchAll<Profile>("profiles", "nome", true),
    fetchAll<UserRole>("user_roles", "id", true),
    fetchOptional<Produtor>("produtores", "nome"),
    fetchOptional<ApoliceRateio>("apolice_rateio"),
  ]);

  return {
    userId: auth.user.id,
    email: auth.user.email ?? profile.email,
    profile,
    empresa,
    isAdmin: roles.some((r) => r.user_id === auth.user.id && r.role === "admin"),
    clientes,
    leads,
    veiculos,
    condutores,
    seguradoras,
    apolices,
    parcelas,
    comissoes,
    tarefas,
    historico_contatos: historico,
    sinistros,
    documentos,
    mensagens,
    atividades,
    profiles,
    user_roles: roles,
    produtores: produtores ?? [],
    apolice_rateio: rateio ?? [],
    temProdutores: produtores !== null,
  };
}

// ---------- Escrita ----------------------------------------------------------
type AnyTable =
  FormTable | "empresas" | "mensagens" | "convites" | "profiles" | "documentos" | "apolice_rateio";

function translateError(message: string): string {
  if (/row-level security|violates row-level/i.test(message))
    return "Você não tem permissão para esta ação ou o registro vinculado não pertence à sua corretora.";
  if (/duplicate key/i.test(message)) {
    if (/apolices_renovacao_unica/.test(message))
      return "Esta apólice já foi renovada por outra apólice.";
    if (/convites_email_pendente/.test(message))
      return "Já existe um convite pendente para este e-mail.";
    return "Já existe um registro com estes dados.";
  }
  if (/foreign key/i.test(message))
    return "Este registro possui vínculos (veículos, apólices, tarefas...) e não pode ser excluído.";
  if (/permission denied/i.test(message)) return "Você não tem permissão para esta ação.";
  return message;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(translateError(error.message));
}

/** Insere ou atualiza. `empresa_id` é sempre o da corretora do usuário. Retorna o id salvo. */
export async function saveRecord(
  table: AnyTable,
  values: FormValues,
  empresaId: string,
  id?: string,
): Promise<string> {
  const payload: FormValues = { ...values };
  delete payload["id"];
  delete payload["created_at"];
  delete payload["updated_at"];
  if (table !== "profiles") payload["empresa_id"] = empresaId;
  // O cliente tipado exige a tabela literal; a validação de colunas acontece no banco.
  const from = supabase.from(table as "clientes");
  if (id) {
    const { error } = await from.update(payload as never).eq("id", id);
    fail(error);
    return id;
  }
  const { data, error } = await from
    .insert(payload as never)
    .select("id")
    .single();
  fail(error);
  return (data as { id: string }).id;
}

export async function updateFields(table: AnyTable, id: string, values: FormValues): Promise<void> {
  const { error } = await supabase
    .from(table as "clientes")
    .update(values as never)
    .eq("id", id);
  fail(error);
}

export async function deleteRecord(table: AnyTable, id: string): Promise<void> {
  const { data, error } = await supabase
    .from(table as "clientes")
    .delete()
    .eq("id", id)
    .select("id");
  fail(error);
  if (!data?.length)
    throw new Error(
      "Não foi possível excluir. Apenas administradores podem excluir este tipo de registro.",
    );
}

type Rpc = Database["public"]["Functions"];
export async function rpc<K extends keyof Rpc>(
  fn: K,
  args?: Rpc[K]["Args"],
): Promise<Rpc[K]["Returns"]> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      f: string,
      a?: unknown,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )(fn, args);
  fail(error);
  return data as Rpc[K]["Returns"];
}

/** Funções que dependem da migração complementar (dados de demonstração). Não usam os tipos
 * gerados, para o app compilar mesmo antes de a migração ser aplicada, e avisam se ela faltar. */
export async function rpcComplemento(fn: "gerar_dados_demo" | "limpar_dados_demo"): Promise<void> {
  // .call(supabase, …): o método precisa do próprio cliente como "this".
  const call = supabase.rpc as unknown as (
    f: string,
  ) => Promise<{ error: { message: string; code?: string } | null }>;
  const { error } = await call.call(supabase, fn);
  if (!error) return;
  if (
    error.code === "PGRST202" ||
    /could not find the function|does not exist/i.test(error.message)
  ) {
    throw new Error(
      "Esta função ainda não existe no banco. Aplique no Lovable a migração 20260930120000_complementos_gestao.sql.",
    );
  }
  fail(error);
}

/** Substitui o rateio de comissão da apólice pelas linhas informadas (vazio = sem rateio). */
export async function saveRateio(
  apoliceId: string,
  empresaId: string,
  linhas: { produtor_id: string; percentual: number }[],
): Promise<void> {
  const del = await supabase.from("apolice_rateio").delete().eq("apolice_id", apoliceId);
  fail(del.error);
  const validas = linhas.filter((l) => l.produtor_id && l.percentual > 0);
  if (!validas.length) return;
  const { error } = await supabase
    .from("apolice_rateio")
    .insert(validas.map((l) => ({ ...l, apolice_id: apoliceId, empresa_id: empresaId })));
  fail(error);
}

// ---------- Documentos (Storage privado) --------------------------------------
export const DOCS_BUCKET = "documentos";
const MAX_FILE = 20 * 1024 * 1024;

export async function uploadDocument(
  file: File,
  empresaId: string,
  userId: string,
  links: {
    cliente_id?: string | null | undefined;
    veiculo_id?: string | null | undefined;
    apolice_id?: string | null | undefined;
    sinistro_id?: string | null | undefined;
  },
  categoria: string,
): Promise<void> {
  if (file.size > MAX_FILE) throw new Error("Arquivo maior que 20 MB.");
  const safe = file.name
    .normalize("NFD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-80);
  const path = `${empresaId}/${crypto.randomUUID()}-${safe}`;
  const up = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, file, { upsert: false, ...(file.type ? { contentType: file.type } : {}) });
  if (up.error) throw new Error(`Falha no envio: ${up.error.message}`);
  const { error } = await supabase.from("documentos").insert({
    empresa_id: empresaId,
    nome: file.name,
    caminho: path,
    tamanho: file.size,
    tipo_mime: file.type,
    enviado_por: userId,
    categoria,
    cliente_id: links.cliente_id ?? null,
    veiculo_id: links.veiculo_id ?? null,
    apolice_id: links.apolice_id ?? null,
    sinistro_id: links.sinistro_id ?? null,
  });
  if (error) {
    await supabase.storage.from(DOCS_BUCKET).remove([path]);
    fail(error);
  }
}

export async function documentUrl(path: string, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, 120, download ? { download: true } : undefined);
  if (error || !data) throw new Error("Não foi possível abrir o arquivo.");
  return data.signedUrl;
}

export async function deleteDocument(doc: Documento): Promise<void> {
  await deleteRecord("documentos", doc.id);
  await supabase.storage.from(DOCS_BUCKET).remove([doc.caminho]);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
