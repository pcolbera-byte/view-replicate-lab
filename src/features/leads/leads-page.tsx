import { useMemo, useState } from "react";
import { KanbanSquare, List, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Avatar,
  Card,
  DemoBadge,
  EmptyState,
  FilterSelect,
  ListCount,
  PageHeader,
  RowButton,
  SearchInput,
  Segmented,
  StatusBadge,
  WhatsAppButton,
} from "@/components/shared/ui";
import { LEAD_ORIGINS, LEAD_STAGES } from "@/lib/domain";
import { dateBR, normalize, onlyDigits } from "@/lib/format";
import { updateFields } from "@/lib/data/workspace";
import type { Lead } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { matchProdutor, produtorOptions } from "@/features/produtores/produtores";

export function LeadsPage() {
  const { ws, openForm, openRecord, run, get, message } = useWorkspace();
  const [view, setView] = useState<"quadro" | "lista">("quadro");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [origin, setOrigin] = useState("");
  const [owner, setOwner] = useState("");
  const [dragOver, setDragOver] = useState("");
  const prodOpts = useMemo(() => produtorOptions(ws), [ws]);
  const porProdutor = prodOpts.length > 0;

  const filtered = useMemo(() => {
    const t = normalize(q),
      d = onlyDigits(q);
    return ws.leads.filter(
      (l) =>
        (!t ||
          normalize(l.nome).includes(t) ||
          normalize(l.cidade).includes(t) ||
          (d.length >= 3 && onlyDigits(`${l.whatsapp}${l.telefone}${l.documento}`).includes(d))) &&
        (!stage || l.status === stage) &&
        (!origin || l.origem === origin) &&
        (porProdutor ? matchProdutor(l.produtor_id, owner) : !owner || l.responsavel_id === owner),
    );
  }, [ws.leads, q, stage, origin, owner, porProdutor]);

  const move = (id: string, status: string) => {
    const lead = get.lead(id);
    if (lead && lead.status !== status)
      void run(() => updateFields("leads", id, { status }), `${lead.nome} → ${status}`);
  };

  const conversion = ws.leads.length
    ? Math.round((ws.leads.filter((l) => l.status === "Vendido").length / ws.leads.length) * 100)
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="Relacionamento"
        title="Leads"
        description={`${ws.leads.filter((l) => !["Vendido", "Perdido"].includes(l.status)).length} em andamento · conversão ${conversion}%`}
        actions={
          <Button onClick={() => openForm({ table: "leads" })}>
            <Plus /> Novo lead
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            {
              value: "quadro",
              label: (
                <>
                  <KanbanSquare size={15} /> Kanban
                </>
              ),
            },
            {
              value: "lista",
              label: (
                <>
                  <List size={15} /> Lista
                </>
              ),
            },
          ]}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar nome, telefone, cidade…"
          className="lg:ml-2 lg:w-72"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {view === "lista" && (
            <FilterSelect
              value={stage}
              onChange={setStage}
              options={LEAD_STAGES}
              allLabel="Todas as etapas"
            />
          )}
          <FilterSelect
            value={origin}
            onChange={setOrigin}
            options={LEAD_ORIGINS}
            allLabel="Todas as origens"
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
            allLabel={porProdutor ? "Todos os produtores" : "Todos os corretores"}
          />
        </div>
      </div>

      {view === "quadro" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="flex min-w-max gap-3">
            {LEAD_STAGES.map((s) => {
              const items = filtered.filter((l) => l.status === s);
              return (
                <div
                  key={s}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(s);
                  }}
                  onDragLeave={() => setDragOver("")}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver("");
                    move(e.dataTransfer.getData("text/lead"), s);
                  }}
                  className={cn(
                    "w-64 shrink-0 rounded-lg bg-muted/70 p-2.5 transition-colors",
                    dragOver === s && "bg-accent",
                  )}
                >
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <StatusBadge status={s} />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <div className="min-h-20 space-y-2">
                    {items.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        onOpen={() => openRecord("lead", l.id)}
                        onMove={(st) => move(l.id, st)}
                        whatsapp={message("primeiro_contato", { nome: l.nome })}
                        owner={
                          porProdutor
                            ? get.produtorNome(l.produtor_id)
                            : get.usuarioNome(l.responsavel_id)
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Arraste os cartões entre as etapas (no celular, use o seletor do cartão).
          </p>
        </div>
      ) : (
        <>
          <ListCount n={filtered.length} noun="lead" />
          <Card>
            {filtered.length ? (
              filtered.map((l) => (
                <RowButton key={l.id} onClick={() => openRecord("lead", l.id)}>
                  <span className="hidden size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary sm:grid">
                    <Target size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold">
                      {l.nome}
                      <DemoBadge show={l.is_demo} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.produto} · {l.origem} · {l.cidade || "cidade não informada"} · entrou{" "}
                      {dateBR(l.data_entrada)}
                    </p>
                  </div>
                  <span className="hidden text-xs text-muted-foreground md:block">
                    {porProdutor
                      ? get.produtorNome(l.produtor_id)
                      : get.usuarioNome(l.responsavel_id)}
                  </span>
                  <StatusBadge status={l.status} />
                  <WhatsAppButton
                    phone={l.whatsapp || l.telefone}
                    message={message("primeiro_contato", { nome: l.nome })}
                  />
                </RowButton>
              ))
            ) : (
              <EmptyState
                icon={Target}
                title="Nenhum lead encontrado"
                subtitle={
                  q || stage || origin
                    ? "Ajuste os filtros."
                    : "Cadastre o primeiro lead para começar o funil."
                }
              />
            )}
          </Card>
        </>
      )}
    </>
  );
}

function LeadCard({
  lead: l,
  onOpen,
  onMove,
  whatsapp,
  owner,
}: {
  lead: Lead;
  onOpen: () => void;
  onMove: (s: string) => void;
  whatsapp: string;
  owner: string;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/lead", l.id)}
      className="cursor-grab rounded-md border bg-card p-3 shadow-sm active:cursor-grabbing"
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <p className="flex items-center gap-1.5 text-sm font-semibold leading-snug">
          {l.nome}
          <DemoBadge show={l.is_demo} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {l.produto} · {l.origem}
        </p>
      </button>
      <div className="mt-2.5 flex items-center gap-1.5">
        <Avatar name={owner} className="size-6 text-[10px]" />
        <select
          value={l.status}
          onChange={(e) => onMove(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-7 min-w-0 flex-1 rounded border bg-background px-1 text-[11px]"
          title="Mover para etapa"
        >
          {LEAD_STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <WhatsAppButton phone={l.whatsapp || l.telefone} message={whatsapp} className="size-7" />
      </div>
    </div>
  );
}
