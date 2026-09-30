// Funções do servidor chamadas pela tela de assinatura (com a sessão do usuário).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = {
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
          eq: (
            k: string,
            v: string,
          ) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      };
    };
  };
  userId: string;
};

/** Corretora do usuário e se ele é administrador (lido com as permissões dele). */
async function meuAcesso(ctx: Ctx): Promise<{ empresaId: string; admin: boolean }> {
  const { data: perfil } = await ctx.supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  const empresaId = (perfil as { empresa_id?: string } | null)?.empresa_id;
  if (!empresaId) throw new Error("Usuário sem corretora.");
  const { data: papel } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  return { empresaId, admin: !!papel };
}

function origem(): string {
  const req = getRequest();
  const fwd = req.headers.get("x-forwarded-host");
  const url = new URL(req.url);
  return fwd ? `https://${fwd}` : url.origin;
}

export const iniciarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => {
    const email = String(d?.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    return { email };
  })
  .handler(async ({ data, context }) => {
    const { empresaId, admin } = await meuAcesso(context as unknown as Ctx);
    if (!admin) throw new Error("Só o administrador da corretora pode assinar.");
    const { lerAssinatura, atualizarAssinatura } = await import("@/lib/billing/assinatura.server");
    const { criarPreapproval } = await import("@/lib/billing/mercadopago.server");
    const atual = await lerAssinatura(empresaId);
    if (atual.status === "isenta") throw new Error("Esta corretora é isenta de assinatura.");
    if (atual.status === "ativa") throw new Error("A assinatura já está ativa.");
    // Assinando durante o teste grátis, a primeira cobrança fica para o fim do teste.
    const testeAte = String(atual["teste_ate"] ?? "");
    const fimTeste = new Date(`${testeAte}T12:00:00Z`);
    const inicio = testeAte && fimTeste.getTime() > Date.now() + 3_600_000 ? fimTeste : null;
    const p = await criarPreapproval({
      empresaId,
      email: data.email,
      voltarPara: `${origem()}/configuracoes?aba=assinatura&retorno=1`,
      inicio,
    });
    await atualizarAssinatura(empresaId, {
      mp_preapproval_id: p.id,
      mp_status: p.status,
      ...(atual.status === "teste" ? {} : { status: "pendente" }),
    });
    if (!p.init_point) throw new Error("O Mercado Pago não devolveu o link de pagamento.");
    return { url: p.init_point };
  });

export const sincronizarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { empresaId } = await meuAcesso(context as unknown as Ctx);
    const { lerAssinatura, salvarPreapproval } = await import("@/lib/billing/assinatura.server");
    const { buscarPreapproval } = await import("@/lib/billing/mercadopago.server");
    const atual = await lerAssinatura(empresaId);
    if (!atual.mp_preapproval_id) return { status: atual.status };
    const p = await buscarPreapproval(atual.mp_preapproval_id);
    await salvarPreapproval(p);
    return { status: p.status };
  });

export const cancelarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { empresaId, admin } = await meuAcesso(context as unknown as Ctx);
    if (!admin) throw new Error("Só o administrador da corretora pode cancelar.");
    const { lerAssinatura, salvarPreapproval } = await import("@/lib/billing/assinatura.server");
    const { cancelarPreapproval } = await import("@/lib/billing/mercadopago.server");
    const atual = await lerAssinatura(empresaId);
    if (!atual.mp_preapproval_id) throw new Error("Não há assinatura para cancelar.");
    await salvarPreapproval(await cancelarPreapproval(atual.mp_preapproval_id));
    return { ok: true };
  });
