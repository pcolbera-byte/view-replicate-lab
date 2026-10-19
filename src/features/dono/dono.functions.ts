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
