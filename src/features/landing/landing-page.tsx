import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Check,
  FileSpreadsheet,
  MessageCircle,
  PieChart,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark, Wordmark } from "@/components/brand/logo";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/native";
import { LEGAL } from "@/lib/legal";
import { PLANO, valorBR } from "@/lib/plano";

const RECURSOS = [
  {
    icon: RefreshCw,
    titulo: "Renovações sem esquecer nenhuma",
    texto:
      "Todas as apólices que vencem no mês, o que já foi renovado e o que falta, com alerta por faixa de dias.",
  },
  {
    icon: MessageCircle,
    titulo: "WhatsApp com mensagem pronta",
    texto: "Um toque para chamar o cliente com o texto da renovação, cobrança ou boas-vindas.",
  },
  {
    icon: Wallet,
    titulo: "Parcelas e comissões",
    texto:
      "Comissões previstas e recebidas por mês, com rateio entre produtores como no Mais Corret.",
  },
  {
    icon: UsersRound,
    titulo: "Produtores e equipe",
    texto: "Cada produtor vê a própria carteira e comissões; o administrador vê tudo.",
  },
  {
    icon: PieChart,
    titulo: "Relatórios de produção",
    texto: "Produção, taxa de renovação e carteira por produtor e por seguradora.",
  },
  {
    icon: Smartphone,
    titulo: "No computador e no celular",
    texto: "Mesma carteira no escritório e na rua, com app para Android e iPhone.",
  },
];

const FAQ = [
  [
    "Preciso cadastrar cartão para testar?",
    `Não. São ${PLANO.testeDias} dias grátis com tudo liberado. Se gostar, assine pelo site.`,
  ],
  [
    "Consigo trazer minha base do Mais Corret?",
    "Sim. Envie o arquivo .mdb e o sistema importa clientes, veículos, apólices, renovações, produtores e comissões.",
  ],
  ["Posso cancelar quando quiser?", "Pode. Sem multa: o acesso segue até o fim do mês já pago."],
  [
    "Meus dados ficam protegidos?",
    "Cada corretora só enxerga os próprios dados, com acesso por senha e conexão criptografada.",
  ],
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  // Quem já está logado (ou abriu o app das lojas) vai direto para o painel.
  useEffect(() => {
    if (isNativeApp()) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-10 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5 text-lg text-white">
            <BrandMark size={36} /> <Wordmark onDark />
          </a>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-white/85 md:flex">
            <a href="#recursos" className="hover:text-white">
              Recursos
            </a>
            <a href="#preco" className="hover:text-white">
              Preço
            </a>
            <a href="#duvidas" className="hover:text-white">
              Dúvidas
            </a>
          </nav>
          <a
            href="/auth"
            className="ml-auto text-sm font-semibold text-white hover:underline md:ml-0"
          >
            Entrar
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-celeste-strong via-primary to-primary-deep pb-20 pt-32 text-white sm:pt-36">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-48 -top-48 size-[40rem] rounded-full border-[4rem] border-white/10"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-celeste-bright">
              Gestão para corretoras de seguros
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.1] sm:text-5xl">
              Sua carteira organizada. Nenhuma renovação esquecida.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/85">
              Clientes, apólices, renovações, parcelas, sinistros e comissões num só lugar — com
              lembretes, WhatsApp pronto e relatórios por produtor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-primary-deep shadow-lg hover:bg-white/90"
              >
                <a href="/auth?modo=cadastro">
                  Testar {PLANO.testeDias} dias grátis <ArrowRight />
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#preco">Ver preço</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/75">
              Sem cartão para testar. Cancele quando quiser.
            </p>
          </div>
          <MockPainel />
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-celeste">Recursos</p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold">
          Feito para a rotina de quem vive de renovação
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="rounded-xl border bg-card p-6">
              <span className="grid size-11 place-items-center rounded-lg bg-secondary text-celeste">
                <r.icon size={21} />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{r.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-secondary text-celeste">
            <FileSpreadsheet size={26} />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">Vem do Mais Corret?</h2>
            <p className="mt-1 text-muted-foreground">
              Importe a base inteira pelo próprio navegador: clientes, veículos, apólices com o
              histórico de renovações, produtores e rateio de comissão. Pode repetir sem duplicar.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href="/auth?modo=cadastro">Começar agora</a>
          </Button>
        </div>
      </section>

      <section id="preco" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-celeste">Preço</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Um plano, tudo incluído</h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Sem taxa de implantação e sem limite de clientes ou apólices. Pagamento mensal no
              cartão pelo Mercado Pago.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-primary/20 bg-card p-7 shadow-xl shadow-primary/5 sm:p-9">
            <div className="flex items-center gap-2 text-sm font-semibold text-celeste">
              <ShieldCheck size={18} /> {PLANO.nome}
            </div>
            <p className="mt-4 flex items-end gap-1.5">
              <span className="font-display text-5xl font-bold tabular-nums">
                {valorBR(PLANO.valor)}
              </span>
              <span className="pb-1.5 text-muted-foreground">/mês</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Clientes, veículos e apólices ilimitados",
                "Renovações, parcelas, sinistros e comissões",
                "Produtores com rateio de comissão",
                "Importação do Mais Corret",
                "App para Android e iPhone",
                "Usuários da equipe com permissões",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check size={18} className="shrink-0 text-emerald" /> {t}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-8 w-full">
              <a href="/auth?modo=cadastro">
                Começar {PLANO.testeDias} dias grátis <ArrowRight />
              </a>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Sem cartão no teste · cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      <section id="duvidas" className="border-t bg-card">
        <div className="mx-auto max-w-3xl scroll-mt-8 px-4 py-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Dúvidas frequentes</h2>
          <div className="mt-8 divide-y rounded-xl border">
            {FAQ.map(([q, r]) => (
              <details key={q} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {q}
                    <span className="text-celeste transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-primary-deep text-white/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-sm sm:px-6 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5 text-white">
            <BrandMark size={30} /> <Wordmark onDark />
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1 md:ml-auto">
            <a href="/privacidade" className="hover:text-white">
              Privacidade
            </a>
            <a href="/termos" className="hover:text-white">
              Termos de uso
            </a>
            <a href="/excluir-conta" className="hover:text-white">
              Excluir conta
            </a>
            <span>{LEGAL.email}</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Ilustração do painel com dados fictícios (não usa dados de clientes reais). */
function MockPainel() {
  const linhas = [
    ["Marina Albuquerque", "Auto · SUV 2023", "vence em 3 dias", "bg-destructive"],
    ["Transportes Serra Azul", "Frota · 6 veículos", "vence em 9 dias", "bg-orange"],
    ["Ricardo Menezes", "Residencial", "Renovada", "bg-emerald"],
  ] as const;
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="rounded-2xl bg-white p-5 text-foreground shadow-2xl shadow-black/25 ring-1 ring-white/20">
        <div className="flex items-center justify-between">
          <p className="font-display font-bold">Renovações · outubro</p>
          <BellRing size={18} className="text-celeste" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Vencem", "32", "text-foreground"],
            ["Renovadas", "21", "text-emerald"],
            ["A renovar", "11", "text-orange"],
          ].map(([l, n, c]) => (
            <div key={l} className="rounded-lg bg-muted p-2.5">
              <p className={`font-display text-2xl font-bold ${c}`}>{n}</p>
              <p className="text-[11px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 divide-y rounded-lg border">
          {linhas.map(([nome, item, quando, dot]) => (
            <div key={nome} className="flex items-center gap-3 px-3 py-2.5">
              <span className={`size-2.5 shrink-0 rounded-full ${dot}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{nome}</p>
                <p className="truncate text-xs text-muted-foreground">{item}</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{quando}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Comissões do mês</span>
          <span className="font-display font-bold tabular-nums">R$ 8.430,00</span>
        </div>
      </div>
    </div>
  );
}
