import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  Plus,
  RefreshCw,
  Shield,
  Target,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  WhatsAppButton,
} from "@/components/shared/ui";
import { TaskRow } from "@/components/records/sections";
import { RENEWAL_BUCKETS, isActivePolicy, isOpenRenewal, isOpenTask } from "@/lib/domain";
import { dateBR, daysUntil, firstName, money, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const { ws, alertDays, openForm, openRecord, run, get, message } = useWorkspace();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const activeLeads = ws.leads.filter((l) => !["Vendido", "Perdido"].includes(l.status)).length;
  const activePolicies = ws.apolices.filter(isActivePolicy).length;
  const renewals = ws.apolices.filter((a) => isOpenRenewal(a, alertDays));
  const openTasks = ws.tarefas.filter(isOpenTask);
  const myTasks = openTasks.filter((t) => !t.responsavel_id || t.responsavel_id === ws.userId);
  const todayTasks = myTasks
    .filter((t) => daysUntil(t.data) <= 0)
    .sort((a, b) => (a.data + (a.horario ?? "99")).localeCompare(b.data + (b.horario ?? "99")));
  const activeClaims = ws.sinistros.filter((s) => s.status !== "Finalizado").length;
  const pendingCommission = ws.comissoes
    .filter((c) => c.status === "Prevista")
    .reduce((s, c) => s + Number(c.valor), 0);
  const board = RENEWAL_BUCKETS.filter((b) => ["0-7", "8-15", "16-30", "31-60"].includes(b.key));

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date())}
        title={`${greeting}, ${firstName(ws.profile.nome) || "corretor"}!`}
        actions={
          <>
            <Button variant="outline" onClick={() => openForm({ table: "tarefas" })}>
              <Plus /> Tarefa
            </Button>
            <Button onClick={() => openForm({ table: "apolices" })}>
              <Plus /> Apólice
            </Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Leads ativos" value={activeLeads} icon={Target} tone="info" to="/leads" />
        <StatCard
          label="Clientes"
          value={ws.clientes.length}
          icon={UsersRound}
          tone="good"
          to="/clientes"
        />
        <StatCard
          label="Apólices vigentes"
          value={activePolicies}
          icon={Shield}
          tone="good"
          to="/apolices"
        />
        <StatCard
          label="Renovações"
          value={renewals.length}
          icon={RefreshCw}
          tone={renewals.some((a) => daysUntil(a.vencimento) <= 7) ? "bad" : "warn"}
          to="/renovacoes"
          hint={`próximos ${alertDays} dias`}
        />
        <StatCard
          label="Follow-ups"
          value={myTasks.length}
          icon={CalendarCheck}
          tone="info"
          to="/agenda"
          hint={todayTasks.length ? `${todayTasks.length} para hoje` : "nenhum hoje"}
        />
        <StatCard
          label="Sinistros ativos"
          value={activeClaims}
          icon={AlertCircle}
          tone={activeClaims ? "bad" : "neutral"}
          to="/sinistros"
        />
        <StatCard
          label={ws.isAdmin ? "Comissões a receber" : "Minhas comissões"}
          value={<span className="text-xl lg:text-[22px]">{money(pendingCommission)}</span>}
          icon={Wallet}
          tone="good"
          to="/comissoes"
        />
      </div>

      <Card className="mb-8">
        <CardHeader
          title="Renovações"
          subtitle="Apólices vigentes por proximidade do vencimento"
          action={
            <Link
              to="/renovacoes"
              className="flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Ver todas <ArrowRight size={15} />
            </Link>
          }
        />
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 xl:grid-cols-4">
          {board.map((b) => {
            const items = renewals
              .filter((a) => {
                const d = daysUntil(a.vencimento);
                return d >= b.min && d <= b.max;
              })
              .sort((x, y) => x.vencimento.localeCompare(y.vencimento));
            return (
              <div key={b.key} className="bg-card p-3">
                <div className="mb-2 flex items-center gap-2 px-1 text-sm font-bold">
                  <span className={cn("size-2.5 rounded-full", b.dot)} />
                  {b.label}
                  <span className="ml-auto text-xs font-semibold text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.slice(0, 4).map((a) => {
                    const c = get.cliente(a.cliente_id);
                    const v = get.veiculo(a.veiculo_id);
                    return (
                      <div key={a.id} className="rounded-md border bg-background p-2.5">
                        <button
                          type="button"
                          onClick={() => openRecord("apolice", a.id)}
                          className="block w-full text-left"
                        >
                          <p className="truncate text-sm font-semibold">{c?.nome ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {v ? `${v.modelo} · ${v.placa}` : a.ramo} · {a.seguradora}
                          </p>
                        </button>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs font-semibold">
                            {dateBR(a.vencimento)}{" "}
                            <span className="font-normal text-muted-foreground">
                              ({daysUntil(a.vencimento)}d)
                            </span>
                          </span>
                          <WhatsAppButton
                            phone={c?.whatsapp || c?.telefone}
                            message={message("renovacao", {
                              nome: c?.nome,
                              veiculo: v?.modelo,
                              vencimento: a.vencimento,
                            })}
                            className="size-7"
                          />
                        </div>
                      </div>
                    );
                  })}
                  {items.length > 4 && (
                    <Link
                      to="/renovacoes"
                      className="block px-1 text-xs font-semibold text-primary"
                    >
                      + {items.length - 4} apólice(s)
                    </Link>
                  )}
                  {!items.length && (
                    <p className="px-1 py-3 text-xs text-muted-foreground">
                      Nenhuma apólice nesta faixa.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Tarefas de hoje"
            subtitle="Inclui atrasadas · concluir ✓ ou adiar para amanhã"
            action={
              <Link
                to="/agenda"
                className="flex items-center gap-1 text-sm font-semibold text-primary"
              >
                Agenda <ArrowRight size={15} />
              </Link>
            }
          />
          {todayTasks.length ? (
            <div className="divide-y">
              {todayTasks.slice(0, 8).map((t) => (
                <TaskRow
                  key={t.id}
                  t={t}
                  clientName={
                    t.cliente_id ? get.clienteNome(t.cliente_id) : get.lead(t.lead_id)?.nome
                  }
                  onOpen={() => openForm({ table: "tarefas", id: t.id })}
                  run={run}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarCheck}
              title="Tudo em dia"
              subtitle="Nenhuma tarefa para hoje."
              action={
                <Button size="sm" variant="outline" onClick={() => openForm({ table: "tarefas" })}>
                  <Plus /> Nova tarefa
                </Button>
              }
            />
          )}
        </Card>
        <Card>
          <CardHeader title="Atividades recentes" subtitle="O que aconteceu na corretora" />
          {ws.atividades.length ? (
            <ul className="divide-y">
              {ws.atividades.slice(0, 8).map((a) => (
                <li key={a.id} className="flex gap-3 px-4 py-2.5 lg:px-5">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-emerald">
                    <Activity size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{a.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {get.usuarioNome(a.usuario_id)} · {relativeTime(a.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Activity}
              title="Sem atividades ainda"
              subtitle="Novos leads, clientes, apólices e sinistros aparecem aqui."
            />
          )}
        </Card>
      </div>
    </>
  );
}
