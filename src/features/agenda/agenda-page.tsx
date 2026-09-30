import { useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Card,
  CardHeader,
  EmptyState,
  FilterSelect,
  PageHeader,
  Segmented,
} from "@/components/shared/ui";
import { TaskRow } from "@/components/records/sections";
import { TASK_TYPES, isOpenTask } from "@/lib/domain";
import { daysUntil } from "@/lib/format";
import type { Tarefa } from "@/lib/data/types";

export function AgendaPage() {
  const { ws, openForm, run, get } = useWorkspace();
  const [who, setWho] = useState<string>(ws.userId);
  const [tipo, setTipo] = useState("");
  const [show, setShow] = useState<"abertas" | "concluidas">("abertas");

  const tasks = useMemo(
    () =>
      ws.tarefas.filter(
        (t) =>
          (!who || t.responsavel_id === who || (!t.responsavel_id && who === ws.userId)) &&
          (!tipo || t.tipo === tipo),
      ),
    [ws.tarefas, who, tipo, ws.userId],
  );
  const open = tasks
    .filter(isOpenTask)
    .sort((a, b) => (a.data + (a.horario ?? "99")).localeCompare(b.data + (b.horario ?? "99")));
  const closed = tasks
    .filter((t) => !isOpenTask(t))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 50);

  const groups: [string, Tarefa[]][] = [
    ["Atrasadas", open.filter((t) => daysUntil(t.data) < 0)],
    ["Hoje", open.filter((t) => daysUntil(t.data) === 0)],
    ["Amanhã", open.filter((t) => daysUntil(t.data) === 1)],
    ["Próximos 7 dias", open.filter((t) => daysUntil(t.data) > 1 && daysUntil(t.data) <= 7)],
    ["Mais adiante", open.filter((t) => daysUntil(t.data) > 7)],
  ];
  const subject = (t: Tarefa) =>
    t.cliente_id ? get.clienteNome(t.cliente_id) : get.lead(t.lead_id)?.nome;

  return (
    <>
      <PageHeader
        eyebrow="Relacionamento"
        title="Agenda"
        description="Follow-ups, retornos e tarefas da equipe."
        actions={
          <Button onClick={() => openForm({ table: "tarefas" })}>
            <Plus /> Nova tarefa
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented
          value={show}
          onChange={setShow}
          options={[
            { value: "abertas", label: "Pendentes", count: open.length },
            { value: "concluidas", label: "Concluídas/canceladas" },
          ]}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            value={who}
            onChange={setWho}
            options={ws.profiles.map((p) => ({
              value: p.id,
              label: p.id === ws.userId ? "Minhas tarefas" : p.nome || p.email,
            }))}
            allLabel="Toda a equipe"
          />
          <FilterSelect
            value={tipo}
            onChange={setTipo}
            options={TASK_TYPES}
            allLabel="Todos os tipos"
          />
        </div>
      </div>
      {show === "abertas" ? (
        open.length ? (
          <div className="space-y-5">
            {groups
              .filter(([, items]) => items.length)
              .map(([label, items]) => (
                <Card key={label}>
                  <CardHeader
                    title={
                      <span className={label === "Atrasadas" ? "text-destructive" : ""}>
                        {label}{" "}
                        <span className="font-normal text-muted-foreground">· {items.length}</span>
                      </span>
                    }
                  />
                  <div className="divide-y">
                    {items.map((t) => (
                      <TaskRow
                        key={t.id}
                        t={t}
                        clientName={subject(t)}
                        onOpen={() => openForm({ table: "tarefas", id: t.id })}
                        run={run}
                      />
                    ))}
                  </div>
                </Card>
              ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={CalendarDays}
              title="Nenhuma tarefa pendente"
              subtitle="Crie follow-ups para ligações, documentos, renovações e pós-venda."
              action={
                <Button size="sm" onClick={() => openForm({ table: "tarefas" })}>
                  <Plus /> Nova tarefa
                </Button>
              }
            />
          </Card>
        )
      ) : (
        <Card>
          {closed.length ? (
            <div className="divide-y">
              {closed.map((t) => (
                <TaskRow
                  key={t.id}
                  t={t}
                  clientName={subject(t)}
                  onOpen={() => openForm({ table: "tarefas", id: t.id })}
                  run={run}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Nada concluído ainda" />
          )}
        </Card>
      )}
    </>
  );
}
