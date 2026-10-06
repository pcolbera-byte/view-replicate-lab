import { Link2, Pencil, Plus, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge, Card, CardHeader, EmptyState } from "@/components/shared/ui";
import { isActivePolicy } from "@/lib/domain";
import { money } from "@/lib/format";

export function ProdutoresSection() {
  const { ws, openForm, get } = useWorkspace();

  if (!ws.temProdutores)
    return (
      <Card>
        <CardHeader title="Produtores" />
        <EmptyState
          icon={UserRoundCheck}
          title="Falta atualizar o banco de dados"
          subtitle="O banco de dados ainda não tem a atualização 20260930150000_produtores, que ativa os produtores."
        />
      </Card>
    );

  const vigentes = ws.apolices.filter(isActivePolicy);
  const stats = (id: string) => {
    let apolices = 0;
    let premio = 0;
    for (const a of vigentes) {
      const r = get.rateio(a.id);
      const pct = r.length
        ? (r.find((x) => x.produtor_id === id)?.percentual ?? 0) / 100
        : a.produtor_id === id
          ? 1
          : 0;
      if (pct > 0) {
        apolices++;
        premio += Number(a.premio || 0) * pct;
      }
    }
    return {
      clientes: ws.clientes.filter((c) => c.produtor_id === id).length,
      apolices,
      premio,
    };
  };
  const lista = [...ws.produtores].sort(
    (a, b) =>
      (a.tipo === "Corretora" ? 0 : 1) - (b.tipo === "Corretora" ? 0 : 1) ||
      Number(b.ativo) - Number(a.ativo) ||
      a.nome.localeCompare(b.nome),
  );

  return (
    <Card>
      <CardHeader
        title="Produtores"
        subtitle="Quem traz o cliente e divide a comissão, como no Mais Corret. Vincule um produtor a um usuário para que ele veja as próprias comissões."
        action={
          ws.isAdmin && (
            <Button size="sm" onClick={() => openForm({ table: "produtores" })}>
              <Plus /> Novo
            </Button>
          )
        }
      />
      {lista.length ? (
        <div className="divide-y" data-testid="lista-produtores">
          {lista.map((p) => {
            const s = stats(p.id);
            const usuario = get.usuario(p.usuario_id);
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 lg:px-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span className="truncate">{p.nome}</span>
                    {p.tipo === "Corretora" && <Badge tone="info">Corretora</Badge>}
                    {!p.ativo && <Badge tone="neutral">Inativo</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.clientes} cliente(s) · {s.apolices} apólice(s) vigente(s) · {money(s.premio)}{" "}
                    em prêmios
                    {p.percentual_padrao != null && ` · participação ${p.percentual_padrao}%`}
                  </p>
                  {usuario && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald">
                      <Link2 size={12} /> Usuário: {usuario.nome || usuario.email}
                    </p>
                  )}
                </div>
                {ws.isAdmin && (
                  <button
                    type="button"
                    title="Editar"
                    aria-label={`Editar ${p.nome}`}
                    onClick={() => openForm({ table: "produtores", id: p.id })}
                    className="grid size-8 place-items-center rounded-md hover:bg-muted"
                  >
                    <Pencil size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={UserRoundCheck}
          title="Nenhum produtor cadastrado"
          subtitle={
            ws.isAdmin
              ? "Cadastre a corretora e os produtores, ou importe do Mais Corret."
              : "Peça ao administrador para cadastrar."
          }
        />
      )}
    </Card>
  );
}
