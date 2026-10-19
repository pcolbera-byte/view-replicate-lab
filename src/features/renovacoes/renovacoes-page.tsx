import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  RefreshCw,
  ThumbsDown,
  Undo2,
} from "lucide-react";
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
import { dateBR, daysUntil, money, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Apolice } from "@/lib/data/types";
import { apoliceDoProdutor, produtorOptions } from "@/features/produtores/produtores";

type Mode = "abertas" | "mes" | "concluidas";
type Bucket = RenewalBucket | "todas";
type MesFiltro = "todas" | "arenovar" | "renovadas" | "naorenovadas";

/** Situação da renovação de uma apólice que vence no mês (visão "Por mês", como no Mais Corret). */
function situacaoNoMes(a: Apolice): Exclude<MesFiltro, "todas"> | "cancelada" {
  if (a.status === "Cancelada") return "cancelada";
  if (a.status === "Renovada" || a.renovacao_status === "Renovada") return "renovadas";
  if (a.renovacao_status === "Não renovada" || a.status === "Encerrada") return "naorenovadas";
  return "arenovar";
}

const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 15)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function RenovacoesPage() {
  const { ws, alertDays, get } = useWorkspace();
  const [mode, setMode] = useState<Mode>("abertas");
  const [bucket, setBucket] = useState<Bucket>("todas");
  const [owner, setOwner] = useState("");
  const [mes, setMes] = useState(() => todayISO().slice(0, 7));
  const [mesFiltro, setMesFiltro] = useState<MesFiltro>("todas");
  const prodOpts = useMemo(() => produtorOptions(ws), [ws]);
  const porProdutor = prodOpts.length > 0;
  const doDono = (a: Apolice) =>
    porProdutor ? apoliceDoProdutor(a, owner, get.rateio) : !owner || a.responsavel_id === owner;

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
  const doMes = useMemo(
    () =>
      ws.apolices
        .filter((a) => a.vencimento.slice(0, 7) === mes)
        .sort(
          (a, b) =>
            a.vencimento.localeCompare(b.vencimento) ||
            get.clienteNome(a.cliente_id).localeCompare(get.clienteNome(b.cliente_id)),
        ),
    [ws.apolices, mes, get],
  );
  const buckets = RENEWAL_BUCKETS.filter((b) => b.min <= alertDays);
  const inBucket = (key: RenewalBucket) => {
    const b = RENEWAL_BUCKETS.find((x) => x.key === key);
    return (a: { vencimento: string }) => {
      const d = daysUntil(a.vencimento);
      return !!b && d >= b.min && d <= b.max;
    };
  };

  const mesDoDono = doMes.filter(doDono);
  const mesCount = (f: Exclude<MesFiltro, "todas"> | "cancelada") =>
    mesDoDono.filter((a) => situacaoNoMes(a) === f).length;
  const mesTotal = mesDoDono.length - mesCount("cancelada");
  const list = (
    mode === "concluidas"
      ? done
      : mode === "mes"
        ? mesDoDono.filter((a) => {
            const st = situacaoNoMes(a);
            return st !== "cancelada" && (mesFiltro === "todas" || st === mesFiltro);
          })
        : bucket === "todas"
          ? open
          : open.filter(inBucket(bucket))
  ).filter(doDono);

  return (
    <>
      <PageHeader
        eyebrow="Carteira"
        title="Renovações"
        description={
          mode === "mes"
            ? "Todas as apólices que vencem no mês escolhido, renovadas ou não."
            : `Geradas automaticamente das apólices vigentes que vencem nos próximos ${alertDays} dias. Cada apólice aparece uma única vez.`
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "abertas", label: "A renovar", count: open.filter(doDono).length },
            { value: "mes", label: "Por mês" },
            {
              value: "concluidas",
              label: "Concluídas (90 dias)",
              count: done.filter(doDono).length,
            },
          ]}
        />
        <FilterSelect
          aria-label={porProdutor ? "Produtor" : "Responsável"}
          value={owner}
          onChange={setOwner}
          options={
            porProdutor
              ? prodOpts
              : ws.profiles.map((p) => ({ value: p.id, label: p.nome || p.email }))
          }
          allLabel={porProdutor ? "Todos os produtores" : "Todos os responsáveis"}
        />
      </div>

      {mode === "abertas" && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {buckets.map((b) => {
            const n = open.filter(inBucket(b.key)).filter(doDono).length;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBucket(bucket === b.key ? "todas" : b.key)}
                className={cn(
                  "rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40",
                  bucket === b.key && "border-primary ring-1 ring-primary",
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
      )}

      {mode === "mes" && (
        <div className="mb-5 space-y-3" data-testid="renovacoes-mes">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              aria-label="Mês anterior"
              onClick={() => setMes(shiftMonth(mes, -1))}
            >
              <ChevronLeft />
            </Button>
            <h2 className="min-w-44 text-center font-display text-lg font-bold">
              {monthLabel(mes)}
            </h2>
            <Button
              size="icon"
              variant="outline"
              aria-label="Próximo mês"
              onClick={() => setMes(shiftMonth(mes, 1))}
            >
              <ChevronRight />
            </Button>
            {mes !== todayISO().slice(0, 7) && (
              <Button size="sm" variant="ghost" onClick={() => setMes(todayISO().slice(0, 7))}>
                Mês atual
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["todas", "Vencem no mês", mesTotal, "bg-foreground"],
                ["arenovar", "A renovar", mesCount("arenovar"), "bg-warning"],
                ["renovadas", "Renovadas", mesCount("renovadas"), "bg-emerald"],
                ["naorenovadas", "Não renovadas", mesCount("naorenovadas"), "bg-destructive"],
              ] as const
            ).map(([k, label, n, dot]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMesFiltro(k)}
                className={cn(
                  "rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40",
                  mesFiltro === k && "border-primary ring-1 ring-primary",
                )}
              >
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className={cn("size-2.5 rounded-full", dot)} />
                  {label}
                </span>
                <span className="mt-1 block font-display text-2xl font-bold">{n}</span>
              </button>
            ))}
          </div>
          {mesTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              Aproveitamento: {Math.round((mesCount("renovadas") / mesTotal) * 100)}% renovadas ·
              prêmios do mês{" "}
              {money(
                mesDoDono
                  .filter((a) => situacaoNoMes(a) !== "cancelada")
                  .reduce((t, a) => t + Number(a.premio || 0), 0),
              )}
              {mesCount("cancelada") > 0 &&
                ` · ${mesCount("cancelada")} cancelada(s) antes do vencimento não entram na conta`}
            </p>
          )}
        </div>
      )}

      {list.length ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {list.map((a) => (
            <RenewalCard key={a.id} a={a} porProdutor={porProdutor} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={RefreshCw}
            title={
              mode === "concluidas"
                ? "Nenhuma renovação concluída recentemente"
                : mode === "mes"
                  ? "Nenhuma apólice neste filtro do mês"
                  : "Nenhuma renovação pendente nesta faixa"
            }
            subtitle={
              mode === "mes"
                ? "Use as setas para ver outros meses."
                : "Apólices vigentes entram aqui automaticamente conforme se aproximam do vencimento."
            }
          />
        </Card>
      )}
    </>
  );
}

function RenewalCard({ a, porProdutor }: { a: Apolice; porProdutor: boolean }) {
  const { ws, get, message, openRecord } = useWorkspace();
  const r = useRenewalActions();
  const c = get.cliente(a.cliente_id);
  const v = get.veiculo(a.veiculo_id);
  const d = daysUntil(a.vencimento);
  const b = RENEWAL_BUCKETS.find((x) => d >= x.min && d <= x.max);
  const lc = ws.historico_contatos
    .filter((h) => h.apolice_id === a.id || h.cliente_id === a.cliente_id)
    .sort((x, y) => (y.data + y.created_at).localeCompare(x.data + x.created_at))[0];
  const situacao = situacaoNoMes(a);
  const concluded = situacao === "renovadas" || situacao === "naorenovadas";
  const nova =
    situacao === "renovadas" ? ws.apolices.find((x) => x.apolice_anterior_id === a.id) : undefined;
  const rat = get.rateio(a.id);
  const quem = porProdutor
    ? `${get.produtorNome(a.produtor_id)}${rat.length > 1 ? ` +${rat.length - 1}` : ""}`
    : get.usuarioNome(a.responsavel_id);
  const statusLabel =
    situacao === "renovadas"
      ? "Renovada"
      : situacao === "naorenovadas"
        ? "Não renovada"
        : a.renovacao_status;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1.5 size-2.5 shrink-0 rounded-full",
            situacao === "renovadas"
              ? "bg-emerald"
              : situacao === "naorenovadas"
                ? "bg-muted-foreground"
                : (b?.dot ?? "bg-muted-foreground"),
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
            {v ? `${v.marca} ${v.modelo} · ${v.placa}` : a.ramo} · {a.seguradora} {a.numero}
          </p>
        </button>
        <div className="text-right">
          <p className="text-sm font-bold">{dateBR(a.vencimento)}</p>
          {!concluded && (
            <p
              className={cn(
                "text-xs font-semibold",
                d < 0 ? "text-foreground" : d <= 7 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {d < 0 ? `venceu há ${-d}d` : d === 0 ? "vence hoje" : `em ${d} dias`}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-muted/60 p-2.5 text-xs sm:grid-cols-4">
        <Info label="Prêmio anterior" value={money(a.premio)} />
        <Info label="Último contato" value={lc ? `${dateBR(lc.data)} · ${lc.tipo}` : "Nenhum"} />
        <Info label={porProdutor ? "Produtor" : "Responsável"} value={quem} />
        <Info label="Situação" value={<StatusBadge status={statusLabel} />} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {concluded ? (
          <>
            {nova && (
              <button
                type="button"
                onClick={() => openRecord("apolice", nova.id)}
                className="flex-1 text-left text-xs text-emerald hover:underline"
              >
                Nova apólice: {nova.seguradora} {nova.numero} · {money(nova.premio)} até{" "}
                {dateBR(nova.vencimento)}
              </button>
            )}
            {a.renovacao_obs && (
              <p className="flex-1 text-xs text-muted-foreground">Motivo: {a.renovacao_obs}</p>
            )}
            {a.renovacao_status === "Não renovada" && a.status === "Vigente" && (
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
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  );
}
