// Marca como dono da plataforma a conta do proprietário do Corretix, sem precisar do
// editor SQL. Só funciona para os e-mails abaixo, com e-mail confirmado.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Contas do proprietário da plataforma. */
const EMAILS_DONO = ["paulo@prevpluscorretora.com.br"];

export const garantirDono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const user = data?.user;
    if (error || !user?.email) return { dono: false };
    const email = user.email.trim().toLowerCase();
    if (!EMAILS_DONO.includes(email) || !user.email_confirmed_at) return { dono: false };
    const ins = await supabaseAdmin
      .from("plataforma_donos" as "profiles")
      .upsert({ user_id: user.id } as never, { onConflict: "user_id", ignoreDuplicates: true });
    if (ins.error) {
      console.error("[dono]", ins.error.message);
      return { dono: false, erro: ins.error.message };
    }
    return { dono: true };
  });

/** O e-mail é de uma conta de dono (para o app tentar se marcar sozinho). */
export const ehEmailDono = (email: string | null | undefined) =>
  !!email && EMAILS_DONO.includes(email.trim().toLowerCase());

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
// Tabelas lidas pelo painel sem os tipos gerados (algumas ficaram fora deles).
const tabela = (adm: Admin, nome: string) => adm.from(nome as "profiles");

/** Só o dono (marcado no banco, ou a conta do proprietário com e-mail confirmado). */
async function conferirDono(adm: Admin, userId: string) {
  const { data } = await tabela(adm, "plataforma_donos")
    .select("user_id")
    .eq("user_id" as never, userId as never)
    .limit(1);
  if (data?.length) return true;
  const { data: u } = await adm.auth.admin.getUserById(userId);
  return !!u?.user?.email_confirmed_at && ehEmailDono(u.user.email);
}

/** Grava no registro de acessos do dono (que não pode ser apagado). Sem a tabela, só ignora. */
async function registrar(
  adm: Admin,
  userId: string,
  acao: string,
  detalhes: Record<string, unknown> = {},
  corretoraId: string | null = null,
) {
  try {
    const { data: u } = await adm.auth.admin.getUserById(userId);
    const r = await tabela(adm, "dono_acessos").insert({
      user_id: userId,
      email: u?.user?.email ?? null,
      acao,
      corretora_id: corretoraId,
      detalhes,
    } as never);
    if (r.error) console.error("[dono] registro", r.error.message);
  } catch (e) {
    console.error("[dono] registro", e);
  }
}

type UsuarioAuth = {
  id: string;
  email: string | null;
  nome: string | null;
  criado_em: string | null;
  confirmado: boolean;
  ultimo_acesso: string | null;
};

async function todosUsuarios(adm: Admin): Promise<UsuarioAuth[]> {
  const out: UsuarioAuth[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await adm.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const lista = data?.users ?? [];
    for (const u of lista)
      out.push({
        id: u.id,
        email: u.email ?? null,
        nome: (u.user_metadata?.["nome"] ??
          u.user_metadata?.["full_name"] ??
          u.user_metadata?.["name"] ??
          null) as string | null,
        criado_em: u.created_at ?? null,
        confirmado: !!u.email_confirmed_at,
        ultimo_acesso: u.last_sign_in_at ?? null,
      });
    if (lista.length < 1000) break;
  }
  return out;
}

async function contar(adm: Admin, nome: string, empresa: string) {
  const { count } = await tabela(adm, nome)
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresa);
  return count ?? 0;
}

/**
 * Lista das corretoras para o Painel do dono, montada no servidor com a chave de serviço
 * (não depende de função SQL nem de permissões do banco). Traz também quem se cadastrou
 * mas ainda não tem corretora (e-mail não confirmado, cadastro incompleto).
 */
export const listarCorretoras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: adm } = await import("@/integrations/supabase/client.server");
    if (!(await conferirDono(adm, context.userId)))
      throw new Error("Acesso restrito ao dono da plataforma.");

    const [emp, ass, prof, roles, usuarios] = await Promise.all([
      tabela(adm, "empresas")
        .select("id, nome, created_at")
        .order("created_at", { ascending: false }),
      tabela(adm, "assinaturas").select(
        "empresa_id, status, teste_ate, pago_ate, proxima_cobranca, valor, ultimo_pagamento_em",
      ),
      tabela(adm, "profiles").select("id, empresa_id, nome, email, created_at"),
      tabela(adm, "user_roles").select("user_id, role"),
      todosUsuarios(adm),
    ]);
    for (const r of [emp, prof, roles]) if (r.error) throw new Error(r.error.message);
    // Sem a tabela de assinaturas (cobrança ainda não ligada no banco), lista mesmo assim.
    const cobrancaAtiva = !ass.error;
    if (
      ass.error &&
      !/schema cache|does not exist|PGRST205|42P01/i.test(`${ass.error.code} ${ass.error.message}`)
    )
      throw new Error(ass.error.message);

    type Emp = { id: string; nome: string; created_at: string };
    type Ass = {
      empresa_id: string;
      status: string;
      teste_ate: string | null;
      pago_ate: string | null;
      proxima_cobranca: string | null;
      valor: number | null;
      ultimo_pagamento_em: string | null;
    };
    type Prof = { id: string; empresa_id: string; nome: string; email: string; created_at: string };
    const empresas = (emp.data ?? []) as unknown as Emp[];
    const assin = new Map(
      ((cobrancaAtiva ? (ass.data ?? []) : []) as unknown as Ass[]).map((a) => [a.empresa_id, a]),
    );
    const perfis = ((prof.data ?? []) as unknown as Prof[]).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const admins = new Set(
      ((roles.data ?? []) as unknown as { user_id: string; role: string }[])
        .filter((r) => r.role === "admin")
        .map((r) => r.user_id),
    );
    const authPorId = new Map(usuarios.map((u) => [u.id, u]));

    const contagens = await Promise.all(
      empresas.map(async (e) => {
        const [clientes, apolices] = await Promise.all([
          contar(adm, "clientes", e.id),
          contar(adm, "apolices", e.id),
        ]);
        return { clientes, apolices };
      }),
    );

    const linhas = empresas.map((e, i) => {
      const n = contagens[i] ?? { clientes: 0, apolices: 0 };
      const a = assin.get(e.id);
      const daEmpresa = perfis.filter((p) => p.empresa_id === e.id);
      const adm1 = daEmpresa.find((p) => admins.has(p.id)) ?? daEmpresa[0];
      const acessos = daEmpresa
        .map((p) => authPorId.get(p.id)?.ultimo_acesso)
        .filter((x): x is string => !!x)
        .sort();
      return {
        empresa_id: e.id,
        nome: e.nome,
        criada_em: e.created_at,
        status: a?.status ?? "isenta",
        teste_ate: a?.teste_ate ?? null,
        pago_ate: a?.pago_ate ?? null,
        proxima_cobranca: a?.proxima_cobranca ?? null,
        valor: a?.valor == null ? null : Number(a.valor),
        ultimo_pagamento_em: a?.ultimo_pagamento_em ?? null,
        admin_nome: adm1?.nome || null,
        admin_email: adm1?.email || (adm1 ? (authPorId.get(adm1.id)?.email ?? null) : null),
        usuarios: daEmpresa.length,
        clientes: n.clientes,
        apolices: n.apolices,
        ultimo_acesso: acessos.at(-1) ?? null,
      };
    });

    const comPerfil = new Set(perfis.map((p) => p.id));
    const semCorretora = usuarios
      .filter((u) => !comPerfil.has(u.id))
      .sort((a, b) => (b.criado_em ?? "").localeCompare(a.criado_em ?? ""));

    // Registra a consulta (uma vez a cada 30 minutos, para não encher o registro).
    const desde = new Date(Date.now() - 30 * 60_000).toISOString();
    const recente = await tabela(adm, "dono_acessos")
      .select("id")
      .eq("user_id" as never, context.userId as never)
      .eq("acao" as never, "ver_painel" as never)
      .gte("created_at", desde)
      .limit(1);
    if (!recente.error && !recente.data?.length)
      await registrar(adm, context.userId, "ver_painel", { corretoras: linhas.length });

    return { linhas, semCorretora, cobrancaAtiva };
  });

export type AcessoDono = {
  id: string;
  email: string | null;
  acao: string;
  corretora_id: string | null;
  /** Detalhes em JSON (texto, para atravessar a função do servidor). */
  detalhes: string;
  created_at: string;
};

/** Registro de acessos do dono, para o próprio dono conferir. */
export const listarAcessosDono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: adm } = await import("@/integrations/supabase/client.server");
    if (!(await conferirDono(adm, context.userId)))
      throw new Error("Acesso restrito ao dono da plataforma.");
    const { data, error } = await tabela(adm, "dono_acessos")
      .select("id, email, acao, corretora_id, detalhes, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { disponivel: false, itens: [] as AcessoDono[] };
    const itens = (
      (data ?? []) as unknown as (Omit<AcessoDono, "detalhes"> & { detalhes: unknown })[]
    ).map((a) => ({ ...a, detalhes: JSON.stringify(a.detalhes ?? {}) }));
    return { disponivel: true, itens: itens as AcessoDono[] };
  });

/** Registra que o dono exportou a lista de corretoras. */
export const registrarExportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: adm } = await import("@/integrations/supabase/client.server");
    if (!(await conferirDono(adm, context.userId))) return { ok: false };
    await registrar(adm, context.userId, "exportar_lista");
    return { ok: true };
  });
