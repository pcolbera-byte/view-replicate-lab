// Segurança e privacidade: como os dados da corretora são protegidos e o que a equipe do
// Corretix fez na conta (registro que não pode ser apagado).
import { useQuery } from "@tanstack/react-query";
import { Building2, DatabaseBackup, Eye, LoaderCircle, LockKeyhole, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/app/workspace-context";
import { Card, CardHeader } from "@/components/shared/ui";
import { supabase } from "@/integrations/supabase/client";
import { descreverAcessoDono } from "@/lib/acessos-dono";
import { dateTimeBR } from "@/lib/format";

type Acesso = { id: string; acao: string; detalhes: unknown; created_at: string };

const PONTOS = [
  {
    icon: Building2,
    titulo: "Seus dados ficam separados",
    texto:
      "Cada corretora só enxerga os próprios registros. A separação é feita pelo banco de dados, não só pela tela: nenhuma outra corretora consegue ler seus clientes, apólices ou comissões.",
  },
  {
    icon: LockKeyhole,
    titulo: "Acesso só de quem você convida",
    texto:
      "Somente os usuários cadastrados pela sua corretora entram na conta. A conexão é criptografada (HTTPS) e os dados ficam em servidores em nuvem com criptografia.",
  },
  {
    icon: Eye,
    titulo: "A equipe do Corretix não consulta seus clientes",
    texto:
      "O Corretix trata os dados apenas para prestar o serviço. Só acessamos informações da sua corretora para suporte pedido por você ou por obrigação legal, e o que fizermos na sua conta aparece no registro abaixo, que não pode ser apagado.",
  },
  {
    icon: DatabaseBackup,
    titulo: "Os dados são seus",
    texto:
      "O administrador pode baixar uma cópia completa (JSON e planilha) a qualquer momento em Configurações → Backup.",
  },
  {
    icon: Trash2,
    titulo: "Você pode sair quando quiser",
    texto:
      "Ao excluir a conta (Minha conta → Excluir minha conta), os dados da corretora são apagados do sistema.",
  },
];

export function PrivacidadeSection() {
  const { ws } = useWorkspace();
  const q = useQuery({
    queryKey: ["acessos-corretix", ws.empresa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dono_acessos" as "clientes")
        .select("id, acao, detalhes, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return null; // tabela ainda não criada
      return (data ?? []) as unknown as Acesso[];
    },
  });
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Como seus dados são protegidos"
          subtitle={
            <>
              Detalhes na{" "}
              <a href="/privacidade" target="_blank" className="text-celeste underline">
                Política de privacidade
              </a>{" "}
              e nos{" "}
              <a href="/termos" target="_blank" className="text-celeste underline">
                Termos de uso
              </a>
              .
            </>
          }
        />
        <ul className="divide-y">
          {PONTOS.map((p) => (
            <li key={p.titulo} className="flex gap-3 px-4 py-3.5 lg:px-5">
              <p.icon size={18} className="mt-0.5 shrink-0 text-celeste" />
              <div>
                <p className="text-sm font-semibold">{p.titulo}</p>
                <p className="text-sm text-muted-foreground">{p.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card data-testid="acessos-corretix">
        <CardHeader
          title="Ações da equipe Corretix na sua conta"
          subtitle="Registro automático, que ninguém consegue alterar ou apagar."
        />
        {q.isLoading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={16} /> Carregando…
          </p>
        ) : q.data?.length ? (
          <div className="divide-y">
            {q.data.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:gap-4 lg:px-5"
              >
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-36">
                  {dateTimeBR(a.created_at)}
                </span>
                <span>{descreverAcessoDono(a.acao, a.detalhes)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhuma ação da equipe Corretix na sua conta.
          </p>
        )}
      </Card>
    </div>
  );
}
