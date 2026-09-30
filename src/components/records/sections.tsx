// Blocos reutilizados nas fichas: histórico, tarefas, documentos, parcelas, apólices, veículos.
import { useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  CircleDollarSign,
  Download,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Trash2,
  Undo2,
  Upload,
  User2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge, EmptyState, StatusBadge, DemoBadge } from "@/components/shared/ui";
import { dateBR, daysUntil, money, relativeTime, todayISO } from "@/lib/format";
import { DOC_CATEGORIES, installmentStatus, isOpenTask, statusTone } from "@/lib/domain";
import {
  deleteDocument,
  documentUrl,
  rpc,
  updateFields,
  uploadDocument,
} from "@/lib/data/workspace";
import type {
  Apolice,
  Contato,
  Documento,
  FormValues,
  Parcela,
  Sinistro,
  Tarefa,
  Veiculo,
} from "@/lib/data/types";
import { cn } from "@/lib/utils";

const contactIcon: Record<string, typeof Phone> = {
  WhatsApp: MessageCircle,
  Ligação: Phone,
  "E-mail": Mail,
  Presencial: Users,
};

export function ContactTimeline({ items, initial }: { items: Contato[]; initial: FormValues }) {
  const { openForm, get } = useWorkspace();
  const sorted = [...items].sort((a, b) =>
    (b.data + b.created_at).localeCompare(a.data + a.created_at),
  );
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        className="mb-4"
        onClick={() => openForm({ table: "historico_contatos", initial })}
      >
        <Plus /> Registrar contato
      </Button>
      {sorted.length ? (
        <ol className="relative ml-3 border-l pl-6">
          {sorted.map((h) => {
            const Icon = contactIcon[h.tipo] ?? FileText;
            return (
              <li key={h.id} className="mb-5 last:mb-0">
                <span className="absolute -left-3.5 grid size-7 place-items-center rounded-full border bg-card text-celeste">
                  <Icon size={13} />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{dateBR(h.data)}</span>
                  <span>{h.tipo}</span>
                  {h.usuario_id && <span>· {get.usuarioNome(h.usuario_id)}</span>}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm">{h.descricao}</p>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          title="Nenhum contato registrado"
          subtitle="Registre ligações, mensagens e reuniões para manter o histórico do atendimento."
        />
      )}
    </div>
  );
}

export function TaskList({
  items,
  initial,
  compact,
}: {
  items: Tarefa[];
  initial?: FormValues | undefined;
  compact?: boolean | undefined;
}) {
  const { openForm, run, get } = useWorkspace();
  const sorted = [...items].sort(
    (a, b) =>
      Number(isOpenTask(b)) - Number(isOpenTask(a)) ||
      (a.data + (a.horario ?? "")).localeCompare(b.data + (b.horario ?? "")),
  );
  return (
    <div>
      {initial && (
        <Button
          size="sm"
          variant="outline"
          className="mb-3"
          onClick={() => openForm({ table: "tarefas", initial })}
        >
          <Plus /> Nova tarefa
        </Button>
      )}
      {sorted.length ? (
        <div className="divide-y rounded-md border">
          {sorted.map((t) => (
            <TaskRow
              key={t.id}
              t={t}
              compact={compact}
              clientName={get.clienteNome(t.cliente_id)}
              onOpen={() => openForm({ table: "tarefas", id: t.id })}
              run={run}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhuma tarefa"
          subtitle="Crie follow-ups para não esquecer nenhum retorno."
        />
      )}
    </div>
  );
}

export function TaskRow({
  t,
  compact,
  clientName,
  onOpen,
  run,
}: {
  t: Tarefa;
  compact?: boolean | undefined;
  clientName?: string | undefined;
  onOpen: () => void;
  run: ReturnType<typeof useWorkspace>["run"];
}) {
  const open = isOpenTask(t);
  const late = open && daysUntil(t.data) < 0;
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 lg:px-4", !open && "opacity-60")}>
      <button
        type="button"
        title={open ? "Concluir" : "Reabrir"}
        onClick={() =>
          run(
            () => updateFields("tarefas", t.id, { status: open ? "Concluído" : "Pendente" }),
            open ? "Tarefa concluída." : "Tarefa reaberta.",
          )
        }
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
          open
            ? "border-muted-foreground/40 hover:border-emerald hover:bg-emerald/10"
            : "border-emerald bg-emerald text-primary-foreground",
        )}
      >
        {!open && <Check size={13} strokeWidth={3} />}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-sm font-semibold", !open && "line-through")}>{t.titulo}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className={cn(late && "font-semibold text-destructive")}>
            {dateBR(t.data)}
            {t.horario ? ` ${t.horario.slice(0, 5)}` : ""}
          </span>
          {" · "}
          {t.tipo}
          {!compact && clientName && clientName !== "—" ? ` · ${clientName}` : ""}
        </p>
      </button>
      {(t.prioridade === "Urgente" || t.prioridade === "Alta") && open && (
        <Badge tone={statusTone(t.prioridade)} className="hidden sm:inline-flex">
          {t.prioridade}
        </Badge>
      )}
      {open && (
        <button
          type="button"
          title="Adiar para amanhã"
          onClick={() =>
            run(
              () => updateFields("tarefas", t.id, { status: "Adiado", data: todayISO(1) }),
              "Tarefa adiada para amanhã.",
            )
          }
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <CalendarClock size={16} />
        </button>
      )}
    </div>
  );
}

export function DocumentList({
  items,
  links,
}: {
  items: Documento[];
  links: {
    cliente_id?: string | null | undefined;
    veiculo_id?: string | null | undefined;
    apolice_id?: string | null | undefined;
    sinistro_id?: string | null | undefined;
  };
}) {
  const { ws, run, get, confirm } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<string>(
    links.sinistro_id ? "Fotos" : links.apolice_id ? "Apólice" : "Documento pessoal",
  );
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    await run(
      async () => {
        for (const f of Array.from(files))
          await uploadDocument(f, ws.empresa.id, ws.userId, links, categoria);
      },
      files.length > 1 ? `${files.length} arquivos enviados.` : "Arquivo enviado.",
    );
    setBusy(false);
    if (input.current) input.current.value = "";
  }
  async function open(d: Documento, download: boolean) {
    try {
      window.open(await documentUrl(d.caminho, download), "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir.");
    }
  }
  async function remove(d: Documento) {
    if (
      await confirm({
        title: "Excluir documento?",
        description: d.nome,
        confirmLabel: "Excluir",
        destructive: true,
      })
    )
      await run(() => deleteDocument(d), "Documento excluído.");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="h-8 rounded-md border bg-card px-2 text-xs"
        >
          {DOC_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          <Upload /> {busy ? "Enviando…" : "Enviar arquivo"}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx"
          onChange={(e) => upload(e.target.files)}
        />
      </div>
      {items.length ? (
        <div className="divide-y rounded-md border">
          {items.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                <FileText size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{d.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.categoria} · {get.usuarioNome(d.enviado_por)} · {relativeTime(d.created_at)}
                  {d.tamanho ? ` · ${(d.tamanho / 1024 / 1024).toFixed(1)} MB` : ""}
                </p>
              </div>
              <button
                type="button"
                title="Visualizar"
                onClick={() => open(d, false)}
                className="grid size-8 place-items-center rounded-md hover:bg-muted"
              >
                <Eye size={16} />
              </button>
              <button
                type="button"
                title="Baixar"
                onClick={() => open(d, true)}
                className="grid size-8 place-items-center rounded-md hover:bg-muted"
              >
                <Download size={16} />
              </button>
              {(ws.isAdmin || d.enviado_por === ws.userId) && (
                <button
                  type="button"
                  title="Excluir"
                  onClick={() => remove(d)}
                  className="grid size-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="Nenhum documento"
          subtitle="Envie PDF da apólice, CNH, CRLV, fotos e comprovantes. Os arquivos ficam privados à sua corretora."
        />
      )}
    </div>
  );
}

export function InstallmentList({ apolice, items }: { apolice: Apolice; items: Parcela[] }) {
  const { openForm, run } = useWorkspace();
  const sorted = [...items].sort((a, b) => a.numero - b.numero);
  const paid = sorted.filter((p) => p.status === "Pago").reduce((s, p) => s + Number(p.valor), 0);
  return (
    <div>
      {sorted.length ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Pago {money(paid)} de {money(sorted.reduce((s, p) => s + Number(p.valor), 0))}
          </p>
          <div className="divide-y rounded-md border">
            {sorted.map((p) => {
              const st = installmentStatus(p);
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-8 text-center font-display text-sm font-bold text-muted-foreground">
                    {p.numero}ª
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openForm({ table: "parcelas", id: p.id, initial: { apolice_id: apolice.id } })
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-semibold tabular-nums">{money(p.valor)}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence {dateBR(p.vencimento)}
                      {p.data_pagamento ? ` · pago em ${dateBR(p.data_pagamento)}` : ""}
                    </p>
                  </button>
                  <StatusBadge status={st} />
                  {p.status !== "Pago" ? (
                    <button
                      type="button"
                      title="Marcar como paga"
                      onClick={() =>
                        run(
                          () =>
                            updateFields("parcelas", p.id, {
                              status: "Pago",
                              data_pagamento: todayISO(),
                            }),
                          `Parcela ${p.numero} marcada como paga.`,
                        )
                      }
                      className="grid size-8 place-items-center rounded-md text-emerald hover:bg-emerald/10"
                    >
                      <CircleDollarSign size={17} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Desfazer pagamento"
                      onClick={() =>
                        run(() =>
                          updateFields("parcelas", p.id, {
                            status: "Pendente",
                            data_pagamento: null,
                          }),
                        )
                      }
                      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                    >
                      <Undo2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          title="Parcelas não geradas"
          subtitle={`Divida o prêmio de ${money(apolice.premio)} em ${apolice.parcelas_qtd || 1} parcela(s) mensais a partir de ${dateBR(apolice.inicio)}.`}
          action={<GenerateInstallments apolice={apolice} />}
        />
      )}
    </div>
  );
}

function GenerateInstallments({ apolice }: { apolice: Apolice }) {
  const { run } = useWorkspace();
  const [n, setN] = useState(String(apolice.parcelas_qtd || 1));
  return (
    <div className="flex items-center justify-center gap-2">
      <input
        type="number"
        min={1}
        max={24}
        value={n}
        onChange={(e) => setN(e.target.value)}
        className="h-9 w-20 rounded-md border bg-background px-3 text-sm"
      />
      <Button
        size="sm"
        onClick={() =>
          run(
            () => rpc("gerar_parcelas", { _apolice_id: apolice.id, _qtd: Number(n) }),
            "Parcelas e comissões previstas geradas.",
          )
        }
      >
        Gerar parcelas
      </Button>
    </div>
  );
}

export function PolicyRows({ items }: { items: Apolice[] }) {
  const { openRecord, get } = useWorkspace();
  if (!items.length) return <EmptyState title="Nenhuma apólice" />;
  return (
    <div className="divide-y rounded-md border">
      {items.map((a) => {
        const d = daysUntil(a.vencimento);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => openRecord("apolice", a.id)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-semibold">
                {a.seguradora} · {a.numero}
                <DemoBadge show={a.is_demo} />
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {a.ramo}
                {a.veiculo_id ? ` · ${get.veiculoNome(a.veiculo_id)}` : ""} · {dateBR(a.inicio)} a{" "}
                {dateBR(a.vencimento)}
                {a.status === "Vigente" && d >= 0 && d <= 60 ? ` · vence em ${d} dia(s)` : ""}
              </p>
            </div>
            <span className="hidden text-sm font-semibold tabular-nums sm:block">
              {money(a.premio)}
            </span>
            <StatusBadge status={a.status} />
          </button>
        );
      })}
    </div>
  );
}

export function VehicleRows({ items }: { items: Veiculo[] }) {
  const { openRecord, ws } = useWorkspace();
  if (!items.length) return <EmptyState title="Nenhum veículo" />;
  return (
    <div className="divide-y rounded-md border">
      {items.map((v) => {
        const active = ws.apolices.find((a) => a.veiculo_id === v.id && a.status === "Vigente");
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => openRecord("veiculo", v.id)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
          >
            <span className="rounded border-2 border-foreground/80 px-1.5 font-mono text-xs font-bold tracking-wider">
              {v.placa}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {v.marca} {v.modelo}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[v.ano_fabricacao, v.ano_modelo ?? v.ano].filter(Boolean).join("/")} · {v.tipo}
                {v.valor_fipe ? ` · FIPE ${money(v.valor_fipe)}` : ""}
              </p>
            </div>
            {active ? (
              <Badge tone="good">Segurado</Badge>
            ) : (
              <Badge tone="neutral">Sem apólice</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ClaimRows({ items }: { items: Sinistro[] }) {
  const { openRecord, get } = useWorkspace();
  if (!items.length) return <EmptyState title="Nenhum sinistro" />;
  return (
    <div className="divide-y rounded-md border">
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => openRecord("sinistro", s.id)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {s.tipo}
              {s.protocolo ? ` · ${s.protocolo}` : ""}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {dateBR(s.data)} · {get.veiculoNome(s.veiculo_id)}
            </p>
          </div>
          <StatusBadge status={s.status} />
        </button>
      ))}
    </div>
  );
}

export function OwnerLine({ userId }: { userId?: string | null | undefined }) {
  const { get } = useWorkspace();
  if (!userId) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <User2 size={12} /> {get.usuarioNome(userId)}
    </span>
  );
}
