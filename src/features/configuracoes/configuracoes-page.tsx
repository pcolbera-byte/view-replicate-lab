import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Database,
  KeyRound,
  MessageSquareText,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/shared/ui";
import { supabase } from "@/integrations/supabase/client";
import { deleteRecord, rpc, saveRecord, updateFields } from "@/lib/data/workspace";
import { dateBR, fillTemplate, maskDocument, maskPhone } from "@/lib/format";
import { validateDocument, validateEmail } from "@/lib/validation";
import { cn } from "@/lib/utils";

export type SettingsTab =
  "empresa" | "usuarios" | "mensagens" | "seguradoras" | "preferencias" | "conta" | "demo";

const TABS: {
  key: SettingsTab;
  label: string;
  icon: typeof Building2;
  admin?: boolean | undefined;
}[] = [
  { key: "empresa", label: "Empresa", icon: Building2 },
  { key: "usuarios", label: "Usuários", icon: UsersRound },
  { key: "mensagens", label: "Mensagens", icon: MessageSquareText },
  { key: "seguradoras", label: "Seguradoras", icon: ShieldCheck },
  { key: "preferencias", label: "Preferências", icon: Settings2 },
  { key: "conta", label: "Minha conta", icon: UserCog },
  { key: "demo", label: "Dados de demonstração", icon: Database, admin: true },
];

export function ConfiguracoesPage({
  tab,
  onTab,
}: {
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
}) {
  const { ws } = useWorkspace();
  const tabs = TABS.filter((t) => !t.admin || ws.isAdmin);
  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Configurações"
        description={
          ws.isAdmin
            ? "Você é administrador: pode alterar dados da corretora, usuários e mensagens."
            : "Algumas seções só podem ser alteradas pelo administrador."
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-sm transition-colors",
                tab === t.key
                  ? "bg-card font-semibold shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === "empresa" && <EmpresaSection />}
          {tab === "usuarios" && <UsuariosSection />}
          {tab === "mensagens" && <MensagensSection />}
          {tab === "seguradoras" && <SeguradorasSection />}
          {tab === "preferencias" && <PreferenciasSection />}
          {tab === "conta" && <ContaSection />}
          {tab === "demo" && ws.isAdmin && <DemoSection />}
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean | undefined;
}) {
  return (
    <label className={cn("block text-sm font-semibold", wide && "sm:col-span-2")}>
      {label}
      {children}
    </label>
  );
}
const inputCls =
  "mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm font-normal disabled:bg-muted disabled:text-muted-foreground";

function EmpresaSection() {
  const { ws, run } = useWorkspace();
  const e = ws.empresa;
  const [v, setV] = useState({
    nome: e.nome,
    cnpj: e.cnpj ?? "",
    telefone: e.telefone ?? "",
    whatsapp: e.whatsapp ?? "",
    email: e.email ?? "",
    endereco: e.endereco ?? "",
    logo_url: e.logo_url ?? "",
  });
  const dis = !ws.isAdmin;
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const err = validateDocument(v.cnpj) ?? validateEmail(v.email);
    if (err) {
      toast.error(err);
      return;
    }
    await run(() => updateFields("empresas", e.id, v), "Dados da corretora salvos.");
  }
  return (
    <Card>
      <CardHeader
        title="Dados da corretora"
        subtitle="Aparecem no menu e podem ser usados nas mensagens ({corretora})."
      />
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:p-5">
        <Field label="Nome da corretora *" wide>
          <input
            required
            disabled={dis}
            value={v.nome}
            onChange={(x) => setV({ ...v, nome: x.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="CNPJ">
          <input
            disabled={dis}
            value={v.cnpj}
            onChange={(x) => setV({ ...v, cnpj: maskDocument(x.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="E-mail">
          <input
            disabled={dis}
            type="email"
            value={v.email}
            onChange={(x) => setV({ ...v, email: x.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Telefone">
          <input
            disabled={dis}
            value={v.telefone}
            onChange={(x) => setV({ ...v, telefone: maskPhone(x.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="WhatsApp">
          <input
            disabled={dis}
            value={v.whatsapp}
            onChange={(x) => setV({ ...v, whatsapp: maskPhone(x.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="Endereço" wide>
          <input
            disabled={dis}
            value={v.endereco}
            onChange={(x) => setV({ ...v, endereco: x.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Logo (endereço da imagem)" wide>
          <input
            disabled={dis}
            type="url"
            placeholder="https://…"
            value={v.logo_url}
            onChange={(x) => setV({ ...v, logo_url: x.target.value })}
            className={inputCls}
          />
        </Field>
        {ws.isAdmin && (
          <div className="sm:col-span-2">
            <Button type="submit">Salvar</Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function UsuariosSection() {
  const { ws, run, confirm } = useWorkspace();
  const invites = useQuery({
    queryKey: ["convites", ws.empresa.id],
    enabled: ws.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [inv, setInv] = useState({ nome: "", email: "", role: "corretor" as "corretor" | "admin" });
  const roleOf = (id: string) =>
    ws.user_roles.some((r) => r.user_id === id && r.role === "admin") ? "admin" : "corretor";

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (validateEmail(inv.email)) {
      toast.error("E-mail inválido");
      return;
    }
    if (ws.profiles.some((p) => p.email.toLowerCase() === inv.email.toLowerCase())) {
      toast.error("Este e-mail já é usuário da corretora.");
      return;
    }
    const ok = await run(
      () =>
        saveRecord(
          "convites",
          {
            nome: inv.nome,
            email: inv.email.trim().toLowerCase(),
            role: inv.role,
            criado_por: ws.userId,
          },
          ws.empresa.id,
        ),
      "Convite criado.",
    );
    if (ok) {
      setInv({ nome: "", email: "", role: "corretor" });
      void invites.refetch();
    }
  }
  async function setUser(id: string, role: "admin" | "corretor", ativo: boolean) {
    await run(
      () => rpc("definir_usuario", { _user_id: id, _role: role, _ativo: ativo }),
      "Usuário atualizado.",
    );
  }
  async function cancelInvite(id: string) {
    if (
      await confirm({
        title: "Cancelar convite?",
        confirmLabel: "Cancelar convite",
        destructive: true,
      })
    ) {
      const ok = await run(() => deleteRecord("convites", id), "Convite cancelado.");
      if (ok) void invites.refetch();
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Equipe"
          subtitle="Administrador: vê tudo, configura a corretora, exclui registros e dá baixa em comissões. Corretor: opera leads, clientes, apólices, tarefas e vê apenas as próprias comissões."
        />
        <div className="divide-y">
          {ws.profiles.map((p) => {
            const role = roleOf(p.id);
            const me = p.id === ws.userId;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.nome || "—"}{" "}
                    {me && <span className="font-normal text-muted-foreground">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                </div>
                {ws.isAdmin && !me ? (
                  <>
                    <select
                      value={role}
                      onChange={(e) =>
                        setUser(p.id, e.target.value as "admin" | "corretor", p.ativo)
                      }
                      className="h-9 rounded-md border bg-card px-2 text-sm"
                    >
                      <option value="corretor">Corretor</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <Button
                      size="sm"
                      variant={p.ativo ? "ghost" : "outline"}
                      className={p.ativo ? "text-destructive" : ""}
                      onClick={() => setUser(p.id, role, !p.ativo)}
                    >
                      {p.ativo ? "Desativar" : "Reativar"}
                    </Button>
                  </>
                ) : (
                  <Badge tone={role === "admin" ? "info" : "neutral"}>
                    {role === "admin" ? "Administrador" : "Corretor"}
                  </Badge>
                )}
                {!p.ativo && <Badge tone="bad">Desativado</Badge>}
              </div>
            );
          })}
        </div>
      </Card>
      {ws.isAdmin && (
        <Card>
          <CardHeader
            title="Convidar usuário"
            subtitle="A pessoa cria a conta na tela de login usando este e-mail e entra automaticamente na sua corretora com o perfil escolhido."
          />
          <form
            onSubmit={invite}
            className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_1.3fr_auto_auto] sm:items-end lg:p-5"
          >
            <Field label="Nome">
              <input
                value={inv.nome}
                onChange={(e) => setInv({ ...inv, nome: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="E-mail *">
              <input
                required
                type="email"
                value={inv.email}
                onChange={(e) => setInv({ ...inv, email: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Perfil">
              <select
                value={inv.role}
                onChange={(e) => setInv({ ...inv, role: e.target.value as "corretor" | "admin" })}
                className={inputCls}
              >
                <option value="corretor">Corretor</option>
                <option value="admin">Administrador</option>
              </select>
            </Field>
            <Button type="submit" className="h-11">
              <Plus /> Convidar
            </Button>
          </form>
          {invites.data && invites.data.length > 0 && (
            <div className="divide-y border-t">
              {invites.data.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm lg:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.nome || "Sem nome"} · {c.role === "admin" ? "Administrador" : "Corretor"} ·
                      criado em {dateBR(c.created_at)}
                    </p>
                  </div>
                  {c.aceito_em ? (
                    <Badge tone="good">Aceito</Badge>
                  ) : (
                    <>
                      <Badge tone="warn">Aguardando cadastro</Badge>
                      <button
                        type="button"
                        title="Cancelar convite"
                        onClick={() => cancelInvite(c.id)}
                        className="grid size-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function MensagensSection() {
  const { ws, run } = useWorkspace();
  const [edit, setEdit] = useState<Record<string, string>>({});
  const example = {
    nome: "Mariana",
    veiculo: "Corolla",
    vencimento: "15/10/2026",
    corretora: ws.empresa.nome,
  };
  return (
    <Card>
      <CardHeader
        title="Modelos de WhatsApp"
        subtitle="Usados nos botões “Enviar WhatsApp”. Variáveis: {nome} {veiculo} {vencimento} {corretora}. O WhatsApp abre no aparelho com o texto pronto."
      />
      {ws.mensagens.length ? (
        <div className="divide-y">
          {ws.mensagens.map((m) => {
            const value = edit[m.id] ?? m.texto;
            const dirty = edit[m.id] !== undefined && edit[m.id] !== m.texto;
            return (
              <div key={m.id} className="p-4 lg:p-5">
                <p className="mb-2 text-sm font-semibold">{m.titulo}</p>
                <textarea
                  disabled={!ws.isAdmin}
                  rows={3}
                  value={value}
                  onChange={(e) => setEdit({ ...edit, [m.id]: e.target.value })}
                  className="w-full rounded-md border bg-background p-3 text-sm disabled:bg-muted"
                />
                <p className="mt-2 rounded-md bg-emerald/10 p-2.5 text-xs text-foreground">
                  <span className="font-semibold text-emerald">Prévia: </span>
                  {fillTemplate(value, example)}
                </p>
                {dirty && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (
                          await run(
                            () => updateFields("mensagens", m.id, { texto: value }),
                            "Mensagem salva.",
                          )
                        )
                          setEdit(({ [m.id]: _, ...r }) => r);
                      }}
                    >
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEdit(({ [m.id]: _, ...r }) => r)}
                    >
                      Descartar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Nenhum modelo"
          subtitle="Os modelos padrão são criados pela migração do banco."
        />
      )}
    </Card>
  );
}

function SeguradorasSection() {
  const { ws, openForm } = useWorkspace();
  return (
    <Card>
      <CardHeader
        title="Seguradoras"
        subtitle="Lista usada no cadastro de apólices."
        action={
          ws.isAdmin && (
            <Button size="sm" onClick={() => openForm({ table: "seguradoras" })}>
              <Plus /> Nova
            </Button>
          )
        }
      />
      {ws.seguradoras.length ? (
        <div className="divide-y">
          {ws.seguradoras.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 lg:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {s.cnpj || "CNPJ não informado"} ·{" "}
                  {ws.apolices.filter((a) => a.seguradora_id === s.id).length} apólice(s)
                </p>
              </div>
              <Badge tone={s.ativo ? "good" : "neutral"}>{s.ativo ? "Ativa" : "Inativa"}</Badge>
              {ws.isAdmin && (
                <button
                  type="button"
                  title="Editar"
                  onClick={() => openForm({ table: "seguradoras", id: s.id })}
                  className="grid size-8 place-items-center rounded-md hover:bg-muted"
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma seguradora cadastrada"
          subtitle={
            ws.isAdmin
              ? "Cadastre as seguradoras com que a corretora trabalha."
              : "Peça ao administrador para cadastrar."
          }
        />
      )}
    </Card>
  );
}

function PreferenciasSection() {
  const { ws, run } = useWorkspace();
  const [days, setDays] = useState(String(ws.empresa.dias_alerta_renovacao));
  return (
    <Card>
      <CardHeader title="Preferências" />
      <div className="space-y-5 p-4 lg:p-5">
        <Field label="Janela de alerta de renovação">
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <select
              disabled={!ws.isAdmin}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-11 rounded-md border bg-background px-3 text-sm font-normal"
            >
              {[30, 45, 60, 90, 120].map((d) => (
                <option key={d} value={d}>
                  {d} dias antes do vencimento
                </option>
              ))}
            </select>
            {ws.isAdmin && days !== String(ws.empresa.dias_alerta_renovacao) && (
              <Button
                onClick={() =>
                  run(
                    () =>
                      updateFields("empresas", ws.empresa.id, {
                        dias_alerta_renovacao: Number(days),
                      }),
                    "Preferência salva.",
                  )
                }
              >
                Salvar
              </Button>
            )}
          </div>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Define quando a apólice entra em Renovações, no painel e nas notificações.
          </span>
        </Field>
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Notificações internas (sino no topo) avisam sobre: vencimentos em 7 dias, apólices
          vencidas sem renovação, follow-ups atrasados, parcelas em atraso e sinistros parados há
          mais de 7 dias.
        </div>
      </div>
    </Card>
  );
}

function ContaSection() {
  const { ws, run } = useWorkspace();
  const [nome, setNome] = useState(ws.profile.nome);
  const [tel, setTel] = useState(ws.profile.telefone ?? "");
  const [pw, setPw] = useState({ a: "", b: "" });
  async function savePw(e: FormEvent) {
    e.preventDefault();
    if (pw.a.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (pw.a !== pw.b) {
      toast.error("As senhas não conferem.");
      return;
    }
    const ok = await run(async () => {
      const { error } = await supabase.auth.updateUser({ password: pw.a });
      if (error) throw error;
    }, "Senha alterada.");
    if (ok) setPw({ a: "", b: "" });
  }
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Meus dados"
          subtitle={`${ws.email} · ${ws.isAdmin ? "Administrador" : "Corretor"}`}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () => updateFields("profiles", ws.userId, { nome, telefone: tel }),
              "Dados atualizados.",
            );
          }}
          className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:p-5"
        >
          <Field label="Nome">
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Telefone">
            <input
              value={tel}
              onChange={(e) => setTel(maskPhone(e.target.value))}
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Alterar senha" />
        <form onSubmit={savePw} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:p-5">
          <Field label="Nova senha">
            <input
              type="password"
              autoComplete="new-password"
              value={pw.a}
              onChange={(e) => setPw({ ...pw, a: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Confirmar nova senha">
            <input
              type="password"
              autoComplete="new-password"
              value={pw.b}
              onChange={(e) => setPw({ ...pw, b: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline">
              <KeyRound /> Alterar senha
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function DemoSection() {
  const { ws, run, confirm } = useWorkspace();
  const has = ws.clientes.some((c) => c.is_demo);
  return (
    <Card>
      <CardHeader
        title="Dados de demonstração"
        subtitle="Para conhecer o sistema sem digitar nada. Todos os registros são marcados como DEMO."
      />
      <div className="space-y-4 p-4 lg:p-5">
        <p className="text-sm">
          Cria 5 clientes, 8 veículos, 6 apólices (com parcelas e comissões), 4 leads, 5 tarefas, 2
          sinistros e 5 seguradoras. Os dados ficam visíveis só para a sua corretora.
        </p>
        {has ? (
          <Button
            variant="destructive"
            onClick={async () => {
              if (
                await confirm({
                  title: "Limpar dados de demonstração?",
                  description:
                    "Remove todos os registros marcados como DEMO. Seus dados reais não são afetados. As seguradoras de exemplo permanecem.",
                  confirmLabel: "Limpar",
                  destructive: true,
                })
              )
                await run(() => rpc("limpar_dados_demo"), "Dados de demonstração removidos.");
            }}
          >
            <Trash2 /> Limpar dados de demonstração
          </Button>
        ) : (
          <Button
            onClick={() => run(() => rpc("gerar_dados_demo"), "Dados de demonstração criados.")}
          >
            <Database /> Gerar dados de demonstração
          </Button>
        )}
      </div>
    </Card>
  );
}
