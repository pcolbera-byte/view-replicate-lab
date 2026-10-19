// Estrutura da área logada: menu lateral, cabeçalho, navegação inferior (celular) e camadas globais.
import { useState, type ReactNode } from "react";
import { BrandMark, Wordmark } from "@/components/brand/logo";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Target,
  UserPlus,
  X,
  FilePlus2,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  WorkspaceProvider,
  useUiState,
  useWorkspace,
  useWorkspaceQuery,
} from "./workspace-context";
import { GlobalSearch } from "./global-search";
import { SignOutButton } from "./sign-out-button";
import { AcessoGate, TesteBanner } from "@/features/assinatura/acesso";
import { NotificationBell } from "./notifications";
import { MOBILE_TABS, NAV } from "./navigation";
import { RecordForm } from "@/components/forms/record-form";
import { RecordDrawer } from "@/components/records/record-drawer";
import { ConfirmDialog } from "@/components/shared/panel";
import { Avatar } from "@/components/shared/ui";
import { isOpenRenewal } from "@/lib/domain";
import { signOut } from "@/lib/data/workspace";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: ws, isLoading, error, refetch } = useWorkspaceQuery();
  const [ui, setUi] = useUiState();
  const [confirmText, setConfirmText] = useState("");

  if (isLoading)
    return (
      <FullScreen>
        <LoaderCircle className="animate-spin" /> Carregando sua corretora…
      </FullScreen>
    );
  if (error || !ws) {
    return (
      <FullScreen>
        <div className="max-w-sm text-center">
          <h2 className="font-display text-lg font-bold text-foreground">
            Não foi possível carregar os dados
          </h2>
          <p className="mt-2 text-sm">
            {error instanceof Error ? error.message : "Tente novamente."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => refetch()}>Tentar novamente</Button>
            <SignOutButton variant="outline" />
          </div>
        </div>
      </FullScreen>
    );
  }

  const closeConfirm = (v: string | false) => {
    ui.confirm?.resolve(v);
    setConfirmText("");
    setUi((s) => ({ ...s, confirm: null }));
  };

  return (
    <WorkspaceProvider ws={ws} setUi={setUi}>
      <div className="min-h-screen lg:flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Header />
          <TesteBanner />
          <DemoBanner />
          <main className="mx-auto max-w-[1400px] px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-28 lg:pt-8">
            <AcessoGate>{children}</AcessoGate>
          </main>
        </div>
      </div>
      <BottomNav />
      <QuickAdd />
      {ui.record && (
        <RecordDrawer
          key={ui.record.kind + ui.record.id}
          kind={ui.record.kind}
          id={ui.record.id}
          onClose={() => setUi((s) => ({ ...s, record: null }))}
        />
      )}
      {ui.form && (
        <RecordForm
          key={ui.form.table + (ui.form.id ?? "new")}
          req={ui.form}
          onClose={() => setUi((s) => ({ ...s, form: null }))}
        />
      )}
      {ui.confirm && (
        <ConfirmDialog
          open
          title={ui.confirm.title}
          description={ui.confirm.description}
          confirmLabel={ui.confirm.confirmLabel}
          destructive={ui.confirm.destructive}
          input={
            ui.confirm.inputLabel
              ? {
                  label: ui.confirm.inputLabel,
                  value: confirmText,
                  onChange: setConfirmText,
                  required: ui.confirm.inputRequired,
                }
              : undefined
          }
          onCancel={() => closeConfirm(false)}
          onConfirm={() => closeConfirm(confirmText.trim())}
        />
      )}
      <Toaster position="top-center" richColors closeButton />
    </WorkspaceProvider>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 p-6 text-muted-foreground">
      {children}
    </div>
  );
}

function Logo({ compact }: { compact?: boolean | undefined }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <BrandMark size={compact ? 32 : 38} />
      <span className="leading-none">
        <Wordmark onDark={!compact} className={compact ? "text-base" : "text-lg"} />
        {!compact && (
          <span className="mt-1 block text-[10px] font-medium uppercase tracking-widest opacity-60">
            Gestão da corretora
          </span>
        )}
      </span>
    </Link>
  );
}

function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function Sidebar() {
  const { ws, alertDays } = useWorkspace();
  const path = useCurrentPath();
  const renewals = ws.apolices.filter((a) => isOpenRenewal(a, alertDays)).length;
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-primary-deep to-[oklch(0.26_0.08_260)] px-4 py-6 text-primary-foreground lg:flex">
      <div className="mb-8 px-2">
        <Logo />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest opacity-50">
              {g}
            </p>
            {NAV.filter((n) => n.group === g).map((item) => {
              const active = path === item.to || path.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active
                      ? "bg-primary-foreground/15 font-semibold"
                      : "opacity-75 hover:bg-primary-foreground/10 hover:opacity-100",
                  )}
                >
                  <item.icon size={18} />
                  {item.label}
                  {item.to === "/renovacoes" && renewals > 0 && (
                    <span className="ml-auto rounded bg-warning px-1.5 text-xs font-bold text-primary">
                      {renewals}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-4 border-t border-primary-foreground/15 px-2 pt-4">
        <div className="flex items-center gap-3">
          <Avatar name={ws.profile.nome} className="bg-accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{ws.profile.nome || ws.email}</p>
            <p className="truncate text-xs opacity-60">
              {ws.isAdmin ? "Administrador" : "Corretor"} · {ws.empresa.nome}
            </p>
          </div>
          <SignOutButton
            variant="ghost"
            iconOnly
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          />
        </div>
      </div>
    </aside>
  );
}

function Header() {
  const { ws, openForm } = useWorkspace();
  return (
    <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 border-b bg-card/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6 lg:px-10">
      <div className="lg:hidden">
        <Logo compact />
      </div>
      <div className="flex flex-1 justify-end lg:justify-start">
        <GlobalSearch />
      </div>
      <NotificationBell />
      <Button className="hidden sm:inline-flex" onClick={() => openForm({ table: "leads" })}>
        <Plus /> Novo lead
      </Button>
      <Link to="/configuracoes" className="hidden sm:block" title="Minha conta">
        <Avatar name={ws.profile.nome} />
      </Link>
    </header>
  );
}

function DemoBanner() {
  const { ws } = useWorkspace();
  if (!ws.clientes.some((c) => c.is_demo)) return null;
  return (
    <div className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-xs font-medium sm:px-6">
      Você está vendo <strong>dados de demonstração</strong> (marcados como DEMO).{" "}
      {ws.isAdmin ? (
        <Link to="/configuracoes" search={{ aba: "demo" }} className="font-semibold underline">
          Limpar em Configurações
        </Link>
      ) : (
        "O administrador pode removê-los."
      )}
    </div>
  );
}

function BottomNav() {
  const path = useCurrentPath();
  const [more, setMore] = useState(false);
  const tabs = NAV.filter((n) => MOBILE_TABS.includes(n.to));
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch justify-around border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map((item) => {
          const active = path === item.to || path.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-16 flex-col items-center justify-center gap-1 text-[11px]",
                active ? "font-bold text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon size={21} />
              {item.short ?? item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          className="flex min-w-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"
        >
          <Menu size={21} />
          Mais
        </button>
      </nav>
      {more && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setMore(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display font-bold">Menu</p>
              <button
                onClick={() => setMore(false)}
                className="grid size-9 place-items-center rounded-md hover:bg-muted"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.filter((n) => !MOBILE_TABS.includes(n.to)).map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMore(false)}
                  className="flex flex-col items-center gap-2 rounded-lg bg-muted px-2 py-4 text-center text-xs font-medium"
                >
                  <n.icon size={20} className="text-primary" />
                  {n.label}
                </Link>
              ))}
            </div>
            <SignOutButton variant="outline" className="mt-3 w-full" />
          </div>
        </div>
      )}
    </>
  );
}

function QuickAdd() {
  const { openForm } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const actions = [
    { label: "Novo lead", icon: Target, run: () => openForm({ table: "leads" }) },
    { label: "Novo cliente", icon: UserPlus, run: () => openForm({ table: "clientes" }) },
    { label: "Nova apólice", icon: FilePlus2, run: () => openForm({ table: "apolices" }) },
    { label: "Nova tarefa", icon: CalendarPlus, run: () => openForm({ table: "tarefas" }) },
    { label: "Renovações", icon: RefreshCw, run: () => navigate({ to: "/renovacoes" }) },
  ];
  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 lg:bottom-8 lg:right-8">
      {open && <div className="fixed inset-0" onClick={() => setOpen(false)} />}
      {open && (
        <div className="absolute bottom-16 right-0 w-52 rounded-lg border bg-card p-1.5 shadow-xl">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                setOpen(false);
                a.run();
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
            >
              <a.icon size={17} className="text-celeste" />
              {a.label}
            </button>
          ))}
        </div>
      )}
      <Button
        size="icon"
        title="Ação rápida"
        onClick={() => setOpen(!open)}
        className="relative size-14 rounded-full shadow-lg [&_svg]:size-6"
      >
        {open ? <X /> : <Plus />}
      </Button>
    </div>
  );
}
