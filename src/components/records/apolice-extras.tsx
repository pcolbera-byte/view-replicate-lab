// Partes da ficha da apólice ligadas à operação: dados do ramo, coberturas e endossos.
import { useState } from "react";
import { Ban, FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/panel";
import { EmptyState, KeyValues } from "@/components/shared/ui";
import { useWorkspace } from "@/components/app/workspace-context";
import { ENDOSSO_TIPOS, type Apolice, type Cobertura, type Endosso } from "@/lib/data/types";
import { premioAtual } from "@/lib/domain";
import { deleteRecord, rpcSemTipos, saveCoberturas } from "@/lib/data/workspace";
import { COBERTURAS_SUGERIDAS, dadosDoRamo, grupoDoRamo } from "@/lib/ramos";
import { dateBR, money, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const box = "h-10 w-full rounded-md border bg-background px-3 text-sm font-normal";
const lbl = "block text-xs font-semibold text-muted-foreground";

function AvisoMigracao() {
  return (
    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      Para usar esta função, aplique a atualização do banco{" "}
      <strong>20261013120000_operacao_corretora</strong> (Lovable Cloud → SQL).
    </p>
  );
}

// ---------------------------------------------------------------- Dados do ramo
export function DadosRamo({ a }: { a: Apolice }) {
  const itens = dadosDoRamo(a);
  if (!itens.length) return null;
  return (
    <div className="mt-6" data-testid="dados-ramo">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-celeste">
        Dados do seguro {a.ramo}
      </h3>
      <KeyValues
        items={itens.map(([k, v]) => [k, v, k === "Beneficiários" || v.length > 40] as const)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Coberturas
type LinhaCob = { nome: string; limite: string; franquia: string; premio: string };
const paraLinha = (c: Cobertura): LinhaCob => ({
  nome: c.nome,
  limite: c.limite == null ? "" : String(c.limite),
  franquia: c.franquia ?? "",
  premio: c.premio == null ? "" : String(c.premio),
});

export function CoberturasSection({ a }: { a: Apolice }) {
  const { ws, run } = useWorkspace();
  const lista = ws.coberturas
    .filter((c) => c.apolice_id === a.id)
    .sort((x, y) => x.ordem - y.ordem);
  const [editando, setEditando] = useState<LinhaCob[] | null>(null);
  const sugestoes = COBERTURAS_SUGERIDAS[grupoDoRamo(a.ramo)];
  const lmiTotal = lista.reduce((t, c) => t + Number(c.premio || 0), 0);

  async function salvar() {
    if (!editando) return;
    const ok = await run(
      () =>
        saveCoberturas(
          a.id,
          ws.empresa.id,
          editando.map((l) => ({
            nome: l.nome,
            limite: l.limite.trim() ? Number(l.limite) : null,
            franquia: l.franquia,
            premio: l.premio.trim() ? Number(l.premio) : null,
          })),
        ),
      "Coberturas salvas.",
    );
    if (ok) setEditando(null);
  }

  return (
    <div className="mt-6" data-testid="coberturas">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-celeste">Coberturas</h3>
        {ws.temOperacao && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setEditando(
                lista.length
                  ? lista.map(paraLinha)
                  : [{ nome: "", limite: "", franquia: "", premio: "" }],
              )
            }
          >
            <Pencil /> {lista.length ? "Editar" : "Cadastrar"}
          </Button>
        )}
      </div>
      {!ws.temOperacao ? (
        <AvisoMigracao />
      ) : lista.length ? (
        <div className="overflow-hidden rounded-md border text-sm">
          <div className="grid grid-cols-[1fr_7rem_6.5rem] gap-2 bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Cobertura</span>
            <span className="text-right">Limite (LMI)</span>
            <span className="text-right">Franquia</span>
          </div>
          {lista.map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_7rem_6.5rem] gap-2 border-t px-3 py-2">
              <span className="min-w-0">
                {c.nome}
                {c.premio != null && (
                  <span className="block text-xs text-muted-foreground">
                    prêmio {money(c.premio)}
                  </span>
                )}
              </span>
              <span className="text-right tabular-nums">
                {c.limite != null ? money(c.limite) : "—"}
              </span>
              <span className="truncate text-right text-muted-foreground">{c.franquia || "—"}</span>
            </div>
          ))}
          {lmiTotal > 0 && (
            <p className="border-t bg-muted/30 px-3 py-2 text-right text-xs text-muted-foreground">
              Soma dos prêmios por cobertura: {money(lmiTotal)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma cobertura cadastrada.</p>
      )}

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title="Coberturas da apólice"
        description={`${a.seguradora} ${a.numero} · ${a.ramo}`}
        width="w-[min(96vw,760px)]"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void salvar()} data-testid="salvar-coberturas">
              Salvar coberturas
            </Button>
          </>
        }
      >
        {editando && (
          <div className="space-y-3">
            <datalist id={`cob-${a.id}`}>
              {sugestoes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div className="hidden grid-cols-[1fr_8rem_7rem_7rem_2.25rem] gap-2 text-xs font-semibold text-muted-foreground sm:grid">
              <span>Cobertura</span>
              <span>Limite / LMI (R$)</span>
              <span>Franquia</span>
              <span>Prêmio (R$)</span>
              <span />
            </div>
            {editando.map((l, i) => {
              const upd = (patch: Partial<LinhaCob>) =>
                setEditando(editando.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div
                  key={i}
                  className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-[1fr_8rem_7rem_7rem_2.25rem] sm:border-0 sm:p-0"
                >
                  <input
                    aria-label={`Cobertura ${i + 1}`}
                    list={`cob-${a.id}`}
                    value={l.nome}
                    placeholder="Ex.: Incêndio, raio e explosão"
                    onChange={(e) => upd({ nome: e.target.value })}
                    className={cn(box, "col-span-2 sm:col-span-1")}
                  />
                  <input
                    aria-label={`Limite ${i + 1}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder="Limite"
                    value={l.limite}
                    onChange={(e) => upd({ limite: e.target.value })}
                    className={box}
                  />
                  <input
                    aria-label={`Franquia ${i + 1}`}
                    placeholder="Franquia"
                    value={l.franquia}
                    onChange={(e) => upd({ franquia: e.target.value })}
                    className={box}
                  />
                  <input
                    aria-label={`Prêmio ${i + 1}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder="Prêmio"
                    value={l.premio}
                    onChange={(e) => upd({ premio: e.target.value })}
                    className={box}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remover cobertura"
                    onClick={() => setEditando(editando.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditando([...editando, { nome: "", limite: "", franquia: "", premio: "" }])
                }
              >
                <Plus /> Adicionar cobertura
              </Button>
              {sugestoes
                .filter((s) => !editando.some((l) => l.nome === s))
                .slice(0, 4)
                .map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() =>
                      setEditando([
                        ...editando.filter((l) => l.nome.trim()),
                        { nome: s, limite: "", franquia: "", premio: "" },
                      ])
                    }
                  >
                    + {s}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- Endossos
type FormEndosso = {
  tipo: string;
  numero: string;
  data: string;
  inicio: string;
  premio: string;
  comissao: string;
  comissaoManual: boolean;
  descricao: string;
};

export function EndossosSection({ a }: { a: Apolice }) {
  const { ws, run, confirm, get } = useWorkspace();
  const lista = ws.endossos
    .filter((e) => e.apolice_id === a.id)
    .sort((x, y) => y.data_emissao.localeCompare(x.data_emissao));
  const [form, setForm] = useState<FormEndosso | null>(null);
  const [erro, setErro] = useState("");
  const pct = Number(a.comissao_percentual || 0);

  const abrir = (tipo = "Alteração de dados") => {
    setErro("");
    setForm({
      tipo,
      numero: "",
      data: todayISO(),
      inicio: todayISO(),
      premio: "",
      comissao: "",
      comissaoManual: false,
      descricao: "",
    });
  };
  const upd = (patch: Partial<FormEndosso>) =>
    setForm((f) => {
      if (!f) return f;
      const n = { ...f, ...patch };
      if ("premio" in patch && !n.comissaoManual)
        n.comissao = n.premio.trim() ? String(Math.round(Number(n.premio) * pct) / 100) : "";
      return n;
    });

  async function salvar() {
    if (!form) return;
    if (form.tipo === "Cancelamento") {
      const ok = await confirm({
        title: "Cancelar a apólice?",
        description:
          "A apólice ficará como Cancelada. Parcelas pendentes e comissões previstas a partir da data do cancelamento também serão canceladas.",
        confirmLabel: "Registrar cancelamento",
        destructive: true,
      });
      if (ok === false) return;
    }
    const premio = form.premio.trim() ? Number(form.premio) : 0;
    const comissao = form.comissao.trim() ? Number(form.comissao) : 0;
    if (Number.isNaN(premio) || Number.isNaN(comissao)) {
      setErro("Valores inválidos.");
      return;
    }
    const ok = await run(
      () =>
        rpcSemTipos("registrar_endosso", {
          _apolice: a.id,
          _tipo: form.tipo,
          _numero: form.numero.trim(),
          _data: form.data || todayISO(),
          _inicio: form.inicio || null,
          _premio: premio,
          _comissao: comissao,
          _descricao: form.descricao.trim(),
        }),
      form.tipo === "Cancelamento" ? "Cancelamento registrado." : "Endosso registrado.",
    );
    if (ok) setForm(null);
  }

  async function excluir(e: Endosso) {
    const ok = await confirm({
      title: "Excluir este endosso?",
      description:
        e.tipo === "Cancelamento"
          ? "A comissão do endosso será removida. A situação da apólice, das parcelas e das comissões canceladas não volta sozinha: ajuste pela edição, se precisar."
          : "A comissão gerada por este endosso também será removida.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok === false) return;
    await run(() => deleteRecord("endossos", e.id), "Endosso excluído.");
  }

  const totalPremio = lista.reduce((t, e) => t + Number(e.premio_diferenca || 0), 0);
  return (
    <div data-testid="endossos">
      {!ws.temOperacao ? (
        <AvisoMigracao />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => abrir()} disabled={a.status === "Cancelada"}>
              <FilePlus2 /> Novo endosso
            </Button>
            {a.status !== "Cancelada" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => abrir("Cancelamento")}
              >
                <Ban /> Cancelar apólice
              </Button>
            )}
            <div className="flex-1" />
            {lista.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Prêmio original {money(a.premio)} · atual{" "}
                <strong className="text-foreground">{money(premioAtual(a, ws.endossos))}</strong>
              </span>
            )}
          </div>
          {lista.length ? (
            <div className="divide-y rounded-md border">
              {lista.map((e) => (
                <div key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {e.tipo}
                      {e.numero && (
                        <span className="font-normal text-muted-foreground"> · nº {e.numero}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emitido {dateBR(e.data_emissao)}
                      {e.inicio_vigencia
                        ? ` · vigência a partir de ${dateBR(e.inicio_vigencia)}`
                        : ""}
                      {e.criado_por ? ` · ${get.usuarioNome(e.criado_por)}` : ""}
                    </p>
                    {e.descricao && <p className="mt-1 text-sm">{e.descricao}</p>}
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    {Number(e.premio_diferenca) !== 0 && (
                      <p
                        className={cn(
                          "font-semibold",
                          Number(e.premio_diferenca) < 0 ? "text-destructive" : "text-emerald",
                        )}
                      >
                        {Number(e.premio_diferenca) > 0 ? "+" : ""}
                        {money(e.premio_diferenca)}
                      </p>
                    )}
                    {Number(e.comissao_diferenca) !== 0 && (
                      <p className="text-muted-foreground">
                        comissão {Number(e.comissao_diferenca) > 0 ? "+" : ""}
                        {money(e.comissao_diferenca)}
                      </p>
                    )}
                  </div>
                  {ws.isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir endosso"
                      onClick={() => void excluir(e)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
              {totalPremio !== 0 && (
                <p className="bg-muted/30 px-3 py-2 text-right text-xs text-muted-foreground">
                  Diferença total de prêmio: {money(totalPremio)}
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              title="Nenhum endosso"
              subtitle="Registre aqui inclusões, exclusões, trocas de veículo, mudanças de cobertura e cancelamentos."
            />
          )}
        </>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.tipo === "Cancelamento" ? "Cancelamento da apólice" : "Novo endosso"}
        description={`${a.seguradora} ${a.numero} · ${get.clienteNome(a.cliente_id)}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)}>
              Voltar
            </Button>
            <Button
              variant={form?.tipo === "Cancelamento" ? "destructive" : "default"}
              onClick={() => void salvar()}
              data-testid="salvar-endosso"
            >
              {form?.tipo === "Cancelamento" ? "Registrar cancelamento" : "Registrar endosso"}
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Tipo
              <select
                value={form.tipo}
                onChange={(e) => upd({ tipo: e.target.value })}
                className={cn(box, "mt-1")}
              >
                {ENDOSSO_TIPOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Número do endosso
              <input
                value={form.numero}
                onChange={(e) => upd({ numero: e.target.value })}
                className={cn(box, "mt-1")}
              />
            </label>
            <label className={lbl}>
              Data de emissão
              <input
                type="date"
                value={form.data}
                onChange={(e) => upd({ data: e.target.value })}
                className={cn(box, "mt-1")}
              />
            </label>
            <label className={lbl}>
              {form.tipo === "Cancelamento" ? "Cancelada a partir de" : "Vigência a partir de"}
              <input
                type="date"
                value={form.inicio}
                onChange={(e) => upd({ inicio: e.target.value })}
                className={cn(box, "mt-1")}
              />
            </label>
            <label className={lbl}>
              {form.tipo === "Cancelamento"
                ? "Prêmio a restituir (use valor negativo)"
                : "Diferença de prêmio (R$)"}
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0,00 (negativo = restituição)"
                value={form.premio}
                onChange={(e) => upd({ premio: e.target.value })}
                className={cn(box, "mt-1")}
              />
            </label>
            <label className={lbl}>
              Diferença de comissão (R$)
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.comissao}
                onChange={(e) => upd({ comissao: e.target.value, comissaoManual: true })}
                className={cn(box, "mt-1")}
              />
              {pct > 0 && !form.comissaoManual && (
                <span className="mt-1 block font-normal">Calculada com {pct}% da apólice</span>
              )}
            </label>
            <label className={cn(lbl, "sm:col-span-2")}>
              {form.tipo === "Cancelamento" ? "Motivo do cancelamento" : "Descrição"}
              <textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => upd({ descricao: e.target.value })}
                className="mt-1 w-full rounded-md border bg-background p-3 text-sm font-normal"
              />
            </label>
            {erro && <p className="text-sm text-destructive sm:col-span-2">{erro}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
