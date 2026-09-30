import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, Plus, Upload, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Card,
  DemoBadge,
  EmptyState,
  FilterSelect,
  ListCount,
  PageHeader,
  SearchInput,
  WhatsAppButton,
} from "@/components/shared/ui";
import { isActivePolicy } from "@/lib/domain";
import { dateBR, daysUntil, normalize, onlyDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

type Sort = "nome" | "renovacao" | "recentes";

export function ClientesPage() {
  const { ws, openForm, get, message } = useWorkspace();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [owner, setOwner] = useState("");
  const [situacao, setSituacao] = useState("");
  const [sort, setSort] = useState<Sort>("nome");

  const rows = useMemo(() => {
    const t = normalize(q),
      d = onlyDigits(q);
    return ws.clientes
      .map((c) => {
        const vehicles = ws.veiculos.filter((v) => v.cliente_id === c.id).length;
        const policies = ws.apolices.filter((a) => a.cliente_id === c.id);
        const active = policies.filter(isActivePolicy);
        const next = active.map((a) => a.vencimento).sort()[0] ?? null;
        return { c, vehicles, policies: policies.length, active: active.length, next };
      })
      .filter(
        ({ c, active }) =>
          (!t ||
            normalize(`${c.nome} ${c.nome_fantasia} ${c.cidade} ${c.email}`).includes(t) ||
            (d.length >= 3 &&
              onlyDigits(`${c.documento}|${c.whatsapp}|${c.telefone}`).includes(d))) &&
          (!tipo || c.tipo === tipo) &&
          (!owner || c.responsavel_id === owner) &&
          (!situacao || (situacao === "ativos" ? active > 0 : active === 0)),
      )
      .sort((a, b) =>
        sort === "nome"
          ? a.c.nome.localeCompare(b.c.nome)
          : sort === "recentes"
            ? b.c.created_at.localeCompare(a.c.created_at)
            : (a.next ?? "9999").localeCompare(b.next ?? "9999"),
      );
  }, [ws, q, tipo, owner, situacao, sort]);

  const open = (id: string) => navigate({ to: "/clientes/$id", params: { id } });

  return (
    <>
      <PageHeader
        eyebrow="Carteira"
        title="Clientes"
        description={`${ws.clientes.length} clientes · ${ws.clientes.filter((c) => ws.apolices.some((a) => a.cliente_id === c.id && isActivePolicy(a))).length} com apólice vigente`}
        actions={
          <Button onClick={() => openForm({ table: "clientes", onSaved: open })}>
            <Plus /> Novo cliente
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Nome, CPF/CNPJ, telefone, cidade…"
          className="lg:w-80"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            value={tipo}
            onChange={setTipo}
            options={[
              { value: "PF", label: "Pessoa física" },
              { value: "PJ", label: "Pessoa jurídica" },
            ]}
            allLabel="PF e PJ"
          />
          <FilterSelect
            value={situacao}
            onChange={setSituacao}
            options={[
              { value: "ativos", label: "Com apólice vigente" },
              { value: "inativos", label: "Sem apólice vigente" },
            ]}
            allLabel="Todas as situações"
          />
          <FilterSelect
            value={owner}
            onChange={setOwner}
            options={ws.profiles.map((p) => ({ value: p.id, label: p.nome || p.email }))}
            allLabel="Todos os corretores"
          />
          <FilterSelect
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              { value: "nome", label: "Ordenar: nome" },
              { value: "renovacao", label: "Ordenar: próxima renovação" },
              { value: "recentes", label: "Ordenar: mais recentes" },
            ]}
            allLabel={null}
          />
        </div>
      </div>
      <ListCount n={rows.length} noun="cliente" />
      <Card className="overflow-hidden">
        {rows.length ? (
          <>
            <div className="hidden grid-cols-[minmax(0,2.2fr)_1.2fr_1fr_0.6fr_0.6fr_1fr_1fr_44px] gap-3 border-b bg-muted/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
              <span>Nome</span>
              <span>CPF / CNPJ</span>
              <span>Cidade</span>
              <span>Veíc.</span>
              <span>Apól.</span>
              <span>Próx. renovação</span>
              <span>Responsável</span>
              <span />
            </div>
            {rows.map(({ c, vehicles, policies, next }) => {
              const d = next ? daysUntil(next) : null;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && open(c.id)}
                  className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50 xl:grid xl:grid-cols-[minmax(0,2.2fr)_1.2fr_1fr_0.6fr_0.6fr_1fr_1fr_44px] xl:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="hidden size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary sm:grid">
                      {c.tipo === "PJ" ? <Building2 size={17} /> : <User2 size={17} />}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold">
                        {c.nome}
                        <DemoBadge show={c.is_demo} />
                      </p>
                      <p className="truncate text-xs text-muted-foreground xl:hidden">
                        {[c.documento, c.cidade, `${vehicles} veíc.`, `${policies} apól.`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <span className="hidden truncate text-sm tabular-nums xl:block">
                    {c.documento || "—"}
                  </span>
                  <span className="hidden truncate text-sm xl:block">
                    {c.cidade ? `${c.cidade}${c.estado ? `/${c.estado}` : ""}` : "—"}
                  </span>
                  <span className="hidden text-sm tabular-nums xl:block">{vehicles}</span>
                  <span className="hidden text-sm tabular-nums xl:block">{policies}</span>
                  <span
                    className={cn(
                      "text-right text-xs xl:text-left xl:text-sm",
                      d !== null && d <= 30 ? "font-semibold text-destructive" : "",
                    )}
                  >
                    {next ? (
                      <>
                        {dateBR(next)}
                        <span className="block text-[11px] font-normal text-muted-foreground xl:inline">
                          {" "}
                          {d}d
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="hidden truncate text-sm text-muted-foreground xl:block">
                    {get.usuarioNome(c.responsavel_id)}
                  </span>
                  <WhatsAppButton
                    phone={c.whatsapp || c.telefone}
                    message={message("primeiro_contato", { nome: c.nome })}
                  />
                </div>
              );
            })}
          </>
        ) : (
          <EmptyState
            title="Nenhum cliente encontrado"
            subtitle={
              q
                ? "Tente outra busca."
                : ws.clientes.length === 0 && ws.isAdmin
                  ? "Traga a carteira do sistema antigo ou cadastre o primeiro cliente."
                  : "Cadastre clientes ou converta leads vendidos."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {!q && ws.clientes.length === 0 && ws.isAdmin && (
                  <Button size="sm" asChild>
                    <Link to="/configuracoes" search={{ aba: "importar" }}>
                      <Upload /> Importar do Mais Corret
                    </Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={ws.clientes.length === 0 && ws.isAdmin ? "outline" : "default"}
                  onClick={() => openForm({ table: "clientes" })}
                >
                  <Plus /> Novo cliente
                </Button>
              </div>
            }
          />
        )}
      </Card>
    </>
  );
}
