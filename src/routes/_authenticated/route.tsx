import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { lerSnapshot, semConexao } from "@/lib/offline/snapshot";

// Todas as páginas operacionais exigem login. Os dados só são lidos no navegador (ssr: false),
// com a sessão do usuário; o isolamento por corretora é garantido pelo RLS do banco.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (!data.session) {
      // Sem internet a sessão vencida não renova: com a cópia local, segue em modo consulta.
      if (semConexao(error) && (await lerSnapshot())) return { user: null };
      throw redirect({ to: "/auth" });
    }
    return { user: data.session.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
