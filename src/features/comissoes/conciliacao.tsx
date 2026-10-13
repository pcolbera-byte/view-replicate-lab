// Conciliação de comissões: o administrador envia o extrato da seguradora (CSV ou Excel),
// o app confere com as comissões previstas e dá baixa em lote.
import { useMemo, useRef, useState } from "react";
import { CheckCheck, FileUp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, FilterSelect, StatusBadge } from "@/components/shared/ui";
import { ExportarMenu } from "@/components/shared/exportar-menu";
import { useWorkspace } from "@/components/app/workspace-context";
import { rpcSemTipos } from "@/lib/data/workspace";
import { lerPlanilha, type Tabela } from "@/lib/planilha/ler";
import { dateBR, money, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  conciliar,
  distribuir,
  sugerirMapa,
  type LinhaConciliacao,
  type Mapa,
  type Situacao,
} from "./conciliacao-logica";

const ROTULO: Record<Situacao, string> = {
  ok: "Confere",
  divergente: "Valor diferente",
  nao_encontrada: "Não encontrada",
  ja_recebida: "Já recebida",
  invalida: "Linha incompleta",
};
const COR: Record<Situacao, string> = {
  ok: "bg-emerald/15 text-emerald",
  divergente: "bg-warning/20 text-foreground",
  nao_encontrada: "bg-destructive/10 text-destructive",
  ja_recebida: "bg-muted text-muted-foreground",
  invalida: "bg-muted text-muted-foreground",
};

export function ConciliacaoSection() {
  const { ws, get, run, confirm } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState("");
  const [tabela, setTabela] = useState<Tabela | null>(null);
  const [cabecalho, setCabecalho] = useState(0);
  const [mapa, setMapa] = useState<Mapa>({ apolice: -1, valor: -1, parcela: -1, nome: -1 });
  const [seguradora, setSeguradora] = useState("");
  const [data, setData] = useState(todayISO());
  const [erro, setErro] = useState("");
  const [marcadas, setMarcadas] = useState<Set<number> | null>(null);
  const seguradoras = useMemo(
    () => [...new Set(ws.apolices.map((a) => a.seguradora).filter(Boolean))].sort(),
    [ws.apolices],
  );

  const linhas = useMemo<LinhaConciliacao[]>(
    () =>
      tabela && mapa.apolice >= 0 && mapa.valor >= 0
        ? conciliar(tabela, cabecalho, mapa, ws.apolices, ws.comissoes, seguradora)
        : [],
    [tabela, cabecalho, mapa, ws.apolices, ws.comissoes, seguradora],
  );
  // Por padrão: marca as que conferem.
  const selecionadas =
    marcadas ?? new Set(linhas.filter((l) => l.situacao === "ok").map((l) => l.indice));
  const podeBaixar = (l: LinhaConciliacao) =>
    (l.situacao === "ok" || l.situacao === "divergente") && l.comissoes.length > 0;
  const escolhidas = linhas.filter((l) => selecionadas.has(l.indice) && podeBaixar(l));
  const conta = (s: Situacao) => linhas.filter((l) => l.situacao === s).length;
  const totalExtrato = linhas
    .filter((l) => l.situacao !== "invalida")
    .reduce((t, l) => t + (l.valor ?? 0), 0);
  const totalEscolhido = escolhidas.reduce((t, l) => t + (l.valor ?? 0), 0);

  async function abrir(file: File) {
    setErro("");
    try {
      const t = await lerPlanilha(file);
      if (t.length < 2) throw new Error("O arquivo não tem linhas suficientes.");
      const s = sugerirMapa(t);
      setTabela(t);
      setArquivo(file.name);
      setCabecalho(s.cabecalho);
      setMapa(s.mapa);
      setMarcadas(null);
      // Sugere a seguradora pelo nome do arquivo.
      const n = file.name.toLowerCase();
      const seg = seguradoras.find((x) => n.includes(x.toLowerCase().split(" ")[0] ?? "~"));
      if (seg) setSeguradora(seg);
    } catch (e) {
      setTabela(null);
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
  }

  async function baixar() {
    if (!escolhidas.length) return;
    const diverg = escolhidas.filter((l) => l.situacao === "divergente").length;
    const ok = await confirm({
      title: `Dar baixa em ${escolhidas.length} linha(s)?`,
      description: (
        <>
          As comissões serão marcadas como recebidas em {dateBR(data)}, com o valor do extrato (
          {money(totalEscolhido)}).
          {diverg > 0 && ` ${diverg} linha(s) têm valor diferente do previsto.`}
        </>
      ),
      confirmLabel: "Dar baixa",
    });
    if (ok === false) return;
    const itens = escolhidas.flatMap(distribuir);
    const feito = await run(
      () =>
        rpcSemTipos("baixar_comissoes_conciliadas", {
          _seguradora: seguradora,
          _arquivo: arquivo,
          _data: data,
          _linhas: linhas.length,
          _valor_extrato: Math.round(totalExtrato * 100) / 100,
          _itens: itens,
        }),
      `${itens.length} comissão(ões) baixada(s).`,
    );
    if (feito) {
      setTabela(null);
      setArquivo("");
      setMarcadas(null);
    }
  }

  async function desfazer(id: string) {
    const ok = await confirm({
      title: "Desfazer esta conciliação?",
      description: "As comissões baixadas por ela voltam a ficar como previstas.",
      confirmLabel: "Desfazer",
      destructive: true,
    });
    if (ok === false) return;
    await run(() => rpcSemTipos("desfazer_conciliacao", { _id: id }), "Conciliação desfeita.");
  }

  if (!ws.temOperacao)
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        A conciliação precisa da atualização do banco{" "}
        <strong>20261013120000_operacao_corretora</strong> (Lovable Cloud → SQL).
      </Card>
    );

  const cab = tabela?.[cabecalho] ?? [];
  const opcoesColuna = cab.map((c, i) => ({
    value: String(i),
    label: `${String.fromCharCode(65 + (i % 26))} · ${c || "(sem título)"}`,
  }));
  const colSelect = (k: keyof Mapa, label: string, opcional = false) => (
    <label className="text-xs font-semibold text-muted-foreground">
      {label}
      <FilterSelect
        className="mt-1 block w-full"
        aria-label={label}
        value={mapa[k] >= 0 ? String(mapa[k]) : ""}
        onChange={(v) => {
          setMapa({ ...mapa, [k]: v === "" ? -1 : Number(v) });
          setMarcadas(null);
        }}
        options={opcoesColuna}
        allLabel={opcional ? "(não usar)" : "Escolha a coluna"}
      />
    </label>
  );

  return (
    <div className="space-y-5" data-testid="conciliacao">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Extrato de comissões da seguradora</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Envie o arquivo que a seguradora disponibiliza no portal do corretor (.xlsx ou .csv).
              O Corretix encontra cada apólice e parcela, compara com o valor previsto e dá baixa de
              uma vez nas que conferem.
            </p>
            {erro && <p className="mt-2 text-sm font-medium text-destructive">{erro}</p>}
          </div>
          <input
            ref={input}
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            className="hidden"
            data-testid="arquivo-extrato"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void abrir(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => input.current?.click()}>
            <FileUp /> {tabela ? "Trocar arquivo" : "Enviar extrato"}
          </Button>
        </div>

        {tabela && (
          <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 lg:grid-cols-6">
            <label className="text-xs font-semibold text-muted-foreground">
              Seguradora
              <FilterSelect
                className="mt-1 block w-full"
                aria-label="Seguradora do extrato"
                value={seguradora}
                onChange={(v) => {
                  setSeguradora(v);
                  setMarcadas(null);
                }}
                options={seguradoras}
                allLabel="Qualquer seguradora"
              />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Data do pagamento
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 block h-10 w-full rounded-md border bg-card px-3 text-sm text-foreground"
              />
            </label>
            {colSelect("apolice", "Coluna da apólice")}
            {colSelect("valor", "Coluna do valor da comissão")}
            {colSelect("parcela", "Coluna da parcela", true)}
            {colSelect("nome", "Coluna do segurado", true)}
          </div>
        )}
      </Card>

      {tabela && linhas.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(["ok", "divergente", "nao_encontrada", "ja_recebida"] as const).map((s) => (
              <div key={s} className="rounded-lg border bg-card p-3">
                <p className="text-xs font-medium text-muted-foreground">{ROTULO[s]}</p>
                <p className="font-display text-2xl font-bold">{conta(s)}</p>
              </div>
            ))}
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">Total do extrato</p>
              <p className="font-display text-lg font-bold">{money(totalExtrato)}</p>
            </div>
          </div>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <p className="flex-1 text-sm">
                <strong>{escolhidas.length}</strong> selecionada(s) ·{" "}
                <strong>{money(totalEscolhido)}</strong>
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMarcadas(new Set(linhas.filter(podeBaixar).map((l) => l.indice)))}
              >
                Marcar todas que dá para baixar
              </Button>
              <ExportarMenu
                size="sm"
                label="Exportar"
                gerar={() => ({
                  titulo: "Conciliação de comissões",
                  subtitulo: `${arquivo}${seguradora ? ` · ${seguradora}` : ""} · pagamento em ${dateBR(data)}`,
                  empresa: ws.empresa.nome,
                  arquivo: `conciliacao-${seguradora || "extrato"}-${data}`,
                  resumo: [
                    ["Confere", String(conta("ok"))],
                    ["Valor diferente", String(conta("divergente"))],
                    ["Não encontrada", String(conta("nao_encontrada"))],
                    ["Total do extrato", money(totalExtrato)],
                  ],
                  secoes: [
                    {
                      colunas: [
                        { titulo: "Linha", tipo: "inteiro", largura: 6 },
                        { titulo: "Apólice (extrato)", largura: 16 },
                        { titulo: "Parcela", tipo: "inteiro", largura: 7 },
                        { titulo: "Segurado", largura: 24 },
                        { titulo: "Cliente no Corretix", largura: 24 },
                        { titulo: "Valor extrato", tipo: "moeda", largura: 13 },
                        { titulo: "Previsto", tipo: "moeda", largura: 13 },
                        { titulo: "Diferença", tipo: "moeda", largura: 12 },
                        { titulo: "Situação", largura: 14 },
                      ],
                      linhas: linhas.map((l) => [
                        l.indice,
                        l.apoliceTxt,
                        l.parcela,
                        l.nome,
                        l.apolice ? get.clienteNome(l.apolice.cliente_id) : "",
                        l.valor,
                        l.comissoes.length ? l.esperado : null,
                        l.comissoes.length && l.valor !== null
                          ? Math.round((l.valor - l.esperado) * 100) / 100
                          : null,
                        ROTULO[l.situacao],
                      ]),
                    },
                  ],
                })}
              />
              <Button
                size="sm"
                disabled={!escolhidas.length}
                onClick={() => void baixar()}
                data-testid="dar-baixa"
              >
                <CheckCheck /> Dar baixa ({escolhidas.length})
              </Button>
            </div>
            <div className="hidden grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1.6fr)_7rem_7rem_8rem] gap-3 bg-muted/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
              <span />
              <span>Extrato</span>
              <span>No Corretix</span>
              <span className="text-right">Extrato</span>
              <span className="text-right">Previsto</span>
              <span>Situação</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {linhas.map((l) => {
                const pode = podeBaixar(l);
                const marcada = selecionadas.has(l.indice) && pode;
                return (
                  <label
                    key={l.indice}
                    className={cn(
                      "grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-1 border-t px-4 py-2.5 text-sm lg:grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1.6fr)_7rem_7rem_8rem]",
                      pode ? "cursor-pointer hover:bg-muted/40" : "opacity-80",
                    )}
                    data-testid="linha-conciliacao"
                  >
                    <input
                      type="checkbox"
                      className="col-start-1 row-span-3 row-start-1 size-4 self-start lg:row-span-1 lg:row-start-auto lg:self-center"
                      disabled={!pode}
                      checked={marcada}
                      onChange={() => {
                        const s = new Set(selecionadas);
                        if (s.has(l.indice)) s.delete(l.indice);
                        else s.add(l.indice);
                        setMarcadas(s);
                      }}
                    />
                    <span className="col-start-2 row-start-1 min-w-0 lg:col-start-auto lg:row-start-auto">
                      <span className="block truncate font-medium">
                        {l.apoliceTxt || "—"}
                        {l.parcela ? ` · parc. ${l.parcela}` : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        linha {l.indice}
                        {l.nome ? ` · ${l.nome}` : ""}
                      </span>
                    </span>
                    <span className="col-span-2 col-start-2 row-start-2 min-w-0 lg:col-span-1 lg:row-start-auto text-xs text-muted-foreground lg:col-start-auto lg:text-sm lg:text-foreground">
                      {l.apolice ? (
                        <>
                          <span className="block truncate">
                            {get.clienteNome(l.apolice.cliente_id)}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {l.apolice.seguradora} {l.apolice.numero}
                            {l.comissoes.length > 1
                              ? ` · ${l.comissoes.length} produtores`
                              : l.comissoes[0]?.parcela
                                ? ` · parcela ${l.comissoes[0].parcela}`
                                : ""}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="col-start-3 row-start-1 text-right lg:col-start-auto font-semibold tabular-nums lg:row-start-auto">
                      {l.valor !== null ? money(l.valor) : "—"}
                    </span>
                    <span className="hidden text-right tabular-nums text-muted-foreground lg:block">
                      {l.comissoes.length ? money(l.esperado) : "—"}
                    </span>
                    <span className="col-start-2 row-start-3 lg:col-start-auto lg:row-start-auto">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                          COR[l.situacao],
                        )}
                      >
                        {ROTULO[l.situacao]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Card>
        </>
      )}
      {tabela && linhas.length === 0 && (
        <Card className="p-5 text-sm text-muted-foreground">
          Escolha as colunas da apólice e do valor da comissão para conferir o extrato.
        </Card>
      )}

      <Card className="overflow-hidden">
        <p className="border-b bg-muted/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conciliações feitas
        </p>
        {ws.conciliacoes.length ? (
          ws.conciliacoes.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm"
            >
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                <p className="truncate font-medium">
                  {c.seguradora || "Seguradora não informada"} · pagamento{" "}
                  {dateBR(c.data_pagamento)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.arquivo} · {c.baixadas} comissão(ões) de {c.linhas} linha(s) · feita em{" "}
                  {dateBR(c.created_at)}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{money(c.valor_baixado)}</span>
              <StatusBadge status="Recebida" />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Desfazer conciliação"
                title="Desfazer"
                onClick={() => void desfazer(c.id)}
              >
                <Undo2 />
              </Button>
            </div>
          ))
        ) : (
          <EmptyState
            title="Nenhuma conciliação ainda"
            subtitle="Depois de dar baixa por um extrato, ele aparece aqui e pode ser desfeito."
          />
        )}
      </Card>
    </div>
  );
}
