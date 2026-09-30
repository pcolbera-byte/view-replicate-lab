import { useMemo, useState } from "react";
import { CalendarPlus, MessageSquarePlus, RefreshCw, ThumbsDown, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Card,
  CallButton,
  DemoBadge,
  EmptyState,
  FilterSelect,
  PageHeader,
  Segmented,
  StatusBadge,
  WhatsAppButton,
} from "@/components/shared/ui";
import { useRenewalActions } from "@/components/records/renewal";
import { RENEWAL_BUCKETS, isOpenRenewal, type RenewalBucket } from "@/lib/domain";
import { dateBR, daysUntil, money } from "@/lib/format";
import { cn } from "@/lib/utils";

type View = RenewalBucket | "todas" | "concluidas";

export function RenovacoesPage() {
  const { ws, alertDays, get, message, openRecord } = useWorkspace();
  const r = useRenewalActions();
  const [view, setView] = useState<View>("todas");
  const [owner, setOwner] = useState("");

  const open = useMemo(
    () =>
      ws.apolices
        .filter((a) => isOpenRenewal(a, alertDays))
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [ws.apolices, alertDays],
  );
  const done = useMemo(
    () =>
      ws.apolices
        .filter(
          (a) =>
            (a.renovacao_status === "Renovada" || a.renovacao_status === "Não renovada") &&
            daysUntil(a.vencimento) >= -90,
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [ws.apolices],
  );
  const buckets = RENEWAL_BUCKETS.filter((b) => b.min <= alertDays);
  const inBucket = (key: RenewalBucket) => {
    const b = RENEWAL_BUCKETS.find((x) => x.key === key);
    return (a: { vencimento: string }) => {
      const d = daysUntil(a.vencimento);
      return !!b && d >= b.min && d <= b.max;
    };
  };

  const list = (
    view === "concluidas" ? done : view === "todas" ? open : open.filter(inBucket(view))
  ).filter((a) => !owner || a.responsavel_id === owner);
  const lastContact = (clienteId: string, apoliceId: string) =>
    ws.historico_contatos
      .filter((h) => h.apolice_id === apoliceId || h.cliente_id === clienteId)
      .sort((x, y) => (y.data + y.created_at).localeCompare(x.data + x.created_at))[0];

  return (
    <>
      <PageHeader
        eyebrow="Carteira"
        title="Renovações"
        description={`Geradas automaticamente das apólices vigentes que vencem nos próximos ${alertDays} dias. Cada apólice aparece uma única vez.`}
      />
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {buckets.map((b) => {
          const n = open.filter(inBucket(b.key)).length;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setView(view === b.key ? "todas" : b.key)}
              className={cn(
                "rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40",
                view === b.key && "border-primary ring-1 ring-primary",
              )}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className={cn("size-2.5 rounded-full", b.dot)} />
                {b.label}
              </span>
              <span className="mt-1 block font-display text-2xl font-bold">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented
          value={view === "concluidas" ? "concluidas" : "abertas"}
          onChange={(v) => setView(v === "concluidas" ? "concluidas" : "todas")}
          options={[
            { value: "abertas", label: "A renovar", count: open.length },
            { value: "concluidas", label: "Concluídas (90 dias)", count: done.length },
          ]}
        />
        <FilterSelect
          value={owner}
          onChange={setOwner}
          options={ws.profiles.map((p) => ({ value: p.id, label: p.nome || p.email }))}
          allLabel="Todos os responsáveis"
        />
      </div>

      {list.length ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {list.map((a) => {
            const c = get.cliente(a.cliente_id);
            const v = get.veiculo(a.veiculo_id);
            const d = daysUntil(a.vencimento);
            const b = RENEWAL_BUCKETS.find((x) => d >= x.min && d <= x.max);
            const lc = lastContact(a.cliente_id, a.id);
            const concluded =
              a.renovacao_status === "Renovada" || a.renovacao_status === "Não renovada";
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      b?.dot ?? "bg-muted-foreground",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => openRecord("apolice", a.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      {c?.nome ?? "—"}
                      <DemoBadge show={a.is_demo} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {v ? `${v.marca} ${v.modelo} · ${v.placa}` : a.ramo} · {a.seguradora}{" "}
                      {a.numero}
                    </p>
                  </button>
                  <div className="text-right">
                    <p className="text-sm font-bold">{dateBR(a.vencimento)}</p>
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        d < 0
                          ? "text-foreground"
                          : d <= 7
                            ? "text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {d < 0 ? `venceu há ${-d}d` : d === 0 ? "vence hoje" : `em ${d} dias`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-muted/60 p-2.5 text-xs sm:grid-cols-4">
                  <Info label="Prêmio anterior" value={money(a.premio)} />
                  <Info
                    label="Último contato"
                    value={lc ? `${dateBR(lc.data)} · ${lc.tipo}` : "Nenhum"}
                  />
                  <Info label="Responsável" value={get.usuarioNome(a.responsavel_id)} />
                  <Info label="Situação" value={<StatusBadge status={a.renovacao_status} />} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {concluded ? (
                    <>
                      {a.renovacao_obs && (
                        <p className="flex-1 text-xs text-muted-foreground">
                          Motivo: {a.renovacao_obs}
                        </p>
                      )}
                      {a.renovacao_status === "Não renovada" && (
                        <Button size="sm" variant="ghost" onClick={() => r.reopen(a)}>
                          <Undo2 /> Reabrir
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <WhatsAppButton
                        size="sm"
                        phone={c?.whatsapp || c?.telefone}
                        message={message("renovacao", {
                          nome: c?.nome,
                          veiculo: v?.modelo,
                          vencimento: a.vencimento,
                        })}
                      />
                      <CallButton size="sm" phone={c?.telefone || c?.whatsapp} />
                      <Button size="sm" variant="outline" onClick={() => r.logContact(a)}>
                        <MessageSquarePlus /> Contato
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => r.createTask(a)}>
                        <CalendarPlus /> Tarefa
                      </Button>
                      {a.renovacao_status === "Pendente" && (
                        <Button size="sm" variant="ghost" onClick={() => r.markNegotiating(a)}>
                          Em negociação
                        </Button>
                      )}
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => r.markNotRenewed(a)}
                      >
                        <ThumbsDown /> Não renovada
                      </Button>
                      <Button size="sm" onClick={() => r.renew(a)}>
                        <RefreshCw /> Renovada
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={RefreshCw}
            title={
              view === "concluidas"
                ? "Nenhuma renovação concluída recentemente"
                : "Nenhuma renovação pendente nesta faixa"
            }
            subtitle="Apólices vigentes entram aqui automaticamente conforme se aproximam do vencimento."
          />
        </Card>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  );
}
