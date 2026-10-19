// Painel do dono do Corretix: todas as corretoras clientes e a assinatura de cada uma.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CircleDollarSign,
  Clock,
  Crown,
  History,
  LoaderCircle,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SearchInput,
  Segmented,
  StatCard,
} from "@/components/shared/ui";
import { rpcSemTipos } from "@/lib/data/workspace";
import { ExportarMenu } from "@/components/shared/exportar-menu";
import type { Relatorio } from "@/lib/relatorio/exportar";
import { descreverAcessoDono } from "@/lib/acessos-dono";
import { dateBR, dateTimeBR, normalize, todayISO } from "@/lib/format";
import { PLANO, valorBR } from "@/lib/plano";
import type { Tone } from "@/lib/domain";
import { listarAcessosDono, listarCorretoras, registrarExportacao } from "./dono.functions";

type Linha = {
  empresa_id: string;
  nome: string;
  criada_em: string;
  status: "teste" | "pendente" | "ativa" | "atrasada" | "cancelada" | "isenta";
  teste_ate: string | null;
  pago_ate: string | null;
  proxima_cobranca: string | null;
  valor: number | null;
  ultimo_pagamento_em: string | null;
  admin_nome: string | null;
  admin_email: string | null;
  usuarios: number;
  clientes: number;
  apolices: number;
  ultimo_acesso: string | null;
};

type SemCorretora = {
  id: string;
  email: string | null;
  nome: string | null;
  criado_em: string | null;
  confirmado: boolean;
  ultimo_acesso: string | null;
};

/** Lista montada no servidor; se o servidor falhar, usa a função do banco. */
async function carregar(): Promise<{
  linhas: Linha[];
  semCorretora: SemCorretora[];
  cobrancaAtiva: boolean;
}> {
  try {
    const r = await listarCorretoras();
    return {
      linhas: r.linhas as Linha[],
      semCorretora: r.semCorretora,
      cobrancaAtiva: r.cobrancaAtiva,
    };
  } catch (e) {
    console.error("[dono] servidor", e);
    try {
      const linhas = await rpcSemTipos<Linha[] | null>("dono_corretoras");
      return { linhas: linhas ?? [], semCorretora: [], cobrancaAtiva: true };
    } catch {
      throw e;
    }
  }
}

type Grupo = "teste" | "pagante" | "vencida" | "isenta";
type Filtro = "todas" | Grupo;

const dias = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/** Situação para o dono, com o que importa para a cobrança. */
function situacao(
  l: Linha,
  hoje: string,
): { grupo: Grupo; rotulo: string; tom: Tone; detalhe: string } {
  if (l.status === "isenta")
    return { grupo: "isenta", rotulo: "Isenta", tom: "info", detalhe: "Sem cobrança" };
  if (l.status === "ativa")
    return {
      grupo: "pagante",
      rotulo: "Pagante",
      tom: "good",
      detalhe: l.proxima_cobranca ? `Próxima cobrança ${dateBR(l.proxima_cobranca)}` : "Ativa",
    };
  if (l.status === "atrasada")
    return {
      grupo: "vencida",
      rotulo: "Pagamento recusado",
      tom: "bad",
      detalhe: l.pago_ate ? `Pago até ${dateBR(l.pago_ate)}` : "Aguardando cartão",
    };
  if (l.status === "cancelada") {
    const ate = [l.teste_ate, l.pago_ate].filter(Boolean).sort().at(-1) ?? null;
    return ate && ate >= hoje
      ? { grupo: "pagante", rotulo: "Cancelada", tom: "warn", detalhe: `Acesso até ${dateBR(ate)}` }
      : { grupo: "vencida", rotulo: "Cancelada", tom: "neutral", detalhe: "Sem acesso" };
  }
  const fim = l.teste_ate ?? hoje;
  const d = dias(hoje, fim);
  if (d >= 0)
    return {
      grupo: "teste",
      rotulo: l.status === "pendente" ? "Teste · assinando" : "Em teste",
      tom: d <= 3 ? "warn" : "info",
      detalhe: d === 0 ? "Último dia" : `Faltam ${d} dia${d === 1 ? "" : "s"} (até ${dateBR(fim)})`,
    };
  return {
    grupo: "vencida",
    rotulo: "Teste vencido",
    tom: "bad",
    detalhe: `Venceu em ${dateBR(fim)}`,
  };
}

export function DonoPage() {
  const { ws, confirm } = useWorkspace();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [q, setQ] = useState("");
  const [ocupado, setOcupado] = useState("");
  const hoje = todayISO();
  const query = useQuery({
    queryKey: ["dono-corretoras"],
    queryFn: carregar,
    enabled: ws.souDono,
  });

  const linhas = useMemo(
    () => (query.data?.linhas ?? []).map((l) => ({ ...l, sit: situacao(l, hoje) })),
    [query.data, hoje],
  );
  const conta = (g: Grupo) => linhas.filter((l) => l.sit.grupo === g).length;
  const receita = linhas
    .filter((l) => l.status === "ativa")
    .reduce((t, l) => t + Number(l.valor ?? PLANO.valor), 0);
  const visiveis = linhas.filter((l) => {
    const t = normalize(q);
    return (
      (filtro === "todas" || l.sit.grupo === filtro) &&
      (!t || normalize(`${l.nome} ${l.admin_nome} ${l.admin_email}`).includes(t))
    );
  });

  async function alterar(l: Linha, acao: "estender" | "isentar" | "remover_isencao", nDias = 0) {
    if (acao !== "estender") {
      const ok = await confirm({
        title: acao === "isentar" ? `Isentar ${l.nome}?` : `Remover a isenção de ${l.nome}?`,
        description:
          acao === "isentar"
            ? "A corretora passa a usar o sistema sem cobrança, por tempo indeterminado."
            : "A corretora volta para o teste grátis (no mínimo 7 dias) e depois precisa assinar.",
        confirmLabel: acao === "isentar" ? "Isentar" : "Remover isenção",
        destructive: acao === "remover_isencao",
      });
      if (ok === false) return;
    }
    setOcupado(l.empresa_id + acao);
    try {
      await rpcSemTipos("dono_alterar_assinatura", {
        _empresa: l.empresa_id,
        _acao: acao,
        _dias: nDias,
      });
      await query.refetch();
      toast.success(
        acao === "estender"
          ? `Teste de ${l.nome} estendido em ${nDias} dias.`
          : acao === "isentar"
            ? `${l.nome} agora é isenta.`
            : `${l.nome} voltou para o teste grátis.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar.");
    } finally {
      setOcupado("");
    }
  }

  if (!ws.souDono)
    return (
      <Card>
        <EmptyState
          icon={Crown}
          title="Acesso restrito"
          subtitle="Esta área é só do dono do Corretix."
        />
      </Card>
    );

  return (
    <>
      <PageHeader
        eyebrow="Corretix"
        title="Painel do dono"
        description="Todas as corretoras que usam o sistema e a situação da assinatura de cada uma."
        actions={
          <ExportarMenu
            label="Exportar lista"
            disabled={!linhas.length}
            gerar={() => {
              void registrarExportacao().catch(() => undefined);
              return relatorioCorretoras(linhas, "Corretix");
            }}
            testId="dono-exportar"
          />
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Corretoras" value={linhas.length} icon={Building2} tone="info" />
        <StatCard label="Em teste" value={conta("teste")} icon={Clock} tone="warn" />
        <StatCard label="Pagantes" value={conta("pagante")} icon={ShieldCheck} tone="good" />
        <StatCard
          label="Receita mensal"
          value={<span className="text-xl">{valorBR(receita)}</span>}
          icon={CircleDollarSign}
          tone="good"
          hint="assinaturas ativas"
        />
        <StatCard
          label="Vencidas / recusadas"
          value={conta("vencida")}
          icon={TriangleAlert}
          tone={conta("vencida") ? "bad" : "neutral"}
        />
      </div>
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Segmented
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "todas", label: "Todas", count: linhas.length },
            { value: "teste", label: "Em teste", count: conta("teste") },
            { value: "pagante", label: "Pagantes", count: conta("pagante") },
            { value: "vencida", label: "Vencidas", count: conta("vencida") },
            { value: "isenta", label: "Isentas", count: conta("isenta") },
          ]}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Corretora, administrador ou e-mail…"
          className="lg:ml-auto lg:w-80"
        />
      </div>

      {query.data && !query.data.cobrancaAtiva && (
        <div
          className="mb-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          data-testid="dono-sem-cobranca"
        >
          <TriangleAlert className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">A cobrança ainda não está ligada no banco de dados.</p>
            <p>
              Falta criar a tabela de assinaturas. Até lá, todas as corretoras usam o sistema sem
              cobrança e sem prazo de teste, e os botões de prazo/isenção ficam desligados.
            </p>
          </div>
        </div>
      )}
      <Card className="overflow-hidden" data-testid="dono-lista">
        {query.isLoading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={17} /> Carregando corretoras…
          </p>
        ) : query.error ? (
          <EmptyState
            icon={TriangleAlert}
            title="Não foi possível carregar"
            subtitle={query.error instanceof Error ? query.error.message : "Tente novamente."}
          />
        ) : visiveis.length ? (
          <div className="divide-y">
            {visiveis.map((l) => (
              <div
                key={l.empresa_id}
                className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_15rem] lg:items-center lg:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.admin_nome || "—"}
                    {l.admin_email && (
                      <>
                        {" · "}
                        <a
                          href={`mailto:${l.admin_email}`}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <Mail size={11} /> {l.admin_email}
                        </a>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cliente desde {dateBR(l.criada_em)}
                  </p>
                </div>
                <div className="min-w-0">
                  <Badge tone={l.sit.tom}>{l.sit.rotulo}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">{l.sit.detalhe}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>
                    {l.usuarios} usuário(s) · {l.clientes} cliente(s) · {l.apolices} apólice(s)
                  </p>
                  <p>Último acesso: {l.ultimo_acesso ? dateTimeBR(l.ultimo_acesso) : "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 lg:justify-end">
                  {query.data?.cobrancaAtiva === false ? (
                    <span className="text-xs text-muted-foreground">Sem cobrança</span>
                  ) : (
                    <>
                      {l.status !== "ativa" && l.status !== "isenta" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!ocupado}
                            onClick={() => alterar(l, "estender", 7)}
                          >
                            +7 dias
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!ocupado}
                            onClick={() => alterar(l, "estender", 30)}
                          >
                            +30 dias
                          </Button>
                        </>
                      )}
                      {l.status !== "isenta" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!ocupado}
                          onClick={() => alterar(l, "isentar")}
                        >
                          Isentar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={!!ocupado || l.empresa_id === ws.empresa.id}
                          title={
                            l.empresa_id === ws.empresa.id ? "Esta é a sua corretora" : undefined
                          }
                          onClick={() => alterar(l, "remover_isencao")}
                        >
                          Remover isenção
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Building2} title="Nenhuma corretora neste filtro" />
        )}
      </Card>
      {!!query.data?.semCorretora.length && (
        <Card className="mt-5 overflow-hidden" data-testid="dono-sem-corretora">
          <div className="border-b px-4 py-3 lg:px-5">
            <p className="font-semibold">
              Cadastros sem corretora ({query.data.semCorretora.length})
            </p>
            <p className="text-xs text-muted-foreground">
              Contas criadas que ainda não montaram a corretora — em geral, e-mail ainda não
              confirmado.
            </p>
          </div>
          <div className="divide-y">
            {query.data.semCorretora.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm lg:flex-row lg:items-center lg:gap-4 lg:px-5"
              >
                <p className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{u.nome || "—"}</span>
                  {u.email && (
                    <>
                      {" · "}
                      <a href={`mailto:${u.email}`} className="hover:underline">
                        {u.email}
                      </a>
                    </>
                  )}
                </p>
                <Badge tone={u.confirmado ? "info" : "warn"}>
                  {u.confirmado ? "E-mail confirmado" : "E-mail não confirmado"}
                </Badge>
                <p className="text-xs text-muted-foreground lg:w-56 lg:text-right">
                  Cadastro {u.criado_em ? dateTimeBR(u.criado_em) : "—"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
      <AcessosDono />
      <p className="mt-3 text-xs text-muted-foreground">
        Pagamentos e estornos ficam no painel do Mercado Pago (Seu negócio → Assinaturas).
      </p>
    </>
  );
}

function relatorioCorretoras(
  linhas: (Linha & { sit: ReturnType<typeof situacao> })[],
  empresa: string,
): Relatorio {
  return {
    titulo: "Corretoras do Corretix",
    subtitulo: `Situação das assinaturas em ${dateBR(todayISO())}`,
    empresa,
    arquivo: `corretix-corretoras-${todayISO()}`,
    paisagem: true,
    resumo: [
      ["Corretoras", String(linhas.length)],
      ["Pagantes", String(linhas.filter((l) => l.sit.grupo === "pagante").length)],
      ["Em teste", String(linhas.filter((l) => l.sit.grupo === "teste").length)],
    ],
    secoes: [
      {
        colunas: [
          { titulo: "Corretora" },
          { titulo: "Administrador" },
          { titulo: "E-mail" },
          { titulo: "Situação" },
          { titulo: "Detalhe" },
          { titulo: "Valor", tipo: "moeda" },
          { titulo: "Usuários", tipo: "inteiro" },
          { titulo: "Clientes", tipo: "inteiro" },
          { titulo: "Apólices", tipo: "inteiro" },
          { titulo: "Cliente desde", tipo: "data" },
        ],
        linhas: linhas.map((l) => [
          l.nome,
          l.admin_nome,
          l.admin_email,
          l.sit.rotulo,
          l.sit.detalhe,
          l.valor,
          l.usuarios,
          l.clientes,
          l.apolices,
          l.criada_em?.slice(0, 10),
        ]),
      },
    ],
  };
}

/** O que o dono fez (fica registrado e não pode ser apagado; cada corretora vê o que é dela). */
function AcessosDono() {
  const [aberto, setAberto] = useState(false);
  const q = useQuery({
    queryKey: ["dono-acessos"],
    queryFn: () => listarAcessosDono(),
    enabled: aberto,
  });
  return (
    <Card className="mt-5 overflow-hidden" data-testid="dono-acessos">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left lg:px-5"
      >
        <History size={18} className="text-muted-foreground" />
        <span className="flex-1">
          <span className="block font-semibold">Registro de acessos do dono</span>
          <span className="block text-xs text-muted-foreground">
            Tudo o que é feito neste painel fica registrado e não pode ser apagado. Cada corretora
            vê, nas Configurações, o que foi feito na conta dela.
          </span>
        </span>
        <span className="text-xs text-celeste">{aberto ? "Ocultar" : "Ver"}</span>
      </button>
      {aberto && (
        <div className="border-t">
          {q.isLoading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <LoaderCircle className="animate-spin" size={16} /> Carregando…
            </p>
          ) : q.error ? (
            <p className="p-4 text-sm text-destructive">
              {q.error instanceof Error ? q.error.message : "Não foi possível carregar."}
            </p>
          ) : !q.data?.disponivel ? (
            <p className="p-4 text-sm text-muted-foreground">
              O registro de acessos ainda não foi criado no banco de dados (falta rodar a
              atualização de segurança).
            </p>
          ) : q.data.itens.length ? (
            <div className="max-h-96 divide-y overflow-auto">
              {q.data.itens.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-0.5 px-4 py-2.5 text-sm lg:flex-row lg:gap-4 lg:px-5"
                >
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground lg:w-36">
                    {dateTimeBR(a.created_at)}
                  </span>
                  <span className="min-w-0 flex-1">{descreverAcessoDono(a.acao, a.detalhes)}</span>
                  <span className="truncate text-xs text-muted-foreground">{a.email}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Nenhum acesso registrado ainda.</p>
          )}
        </div>
      )}
    </Card>
  );
}
