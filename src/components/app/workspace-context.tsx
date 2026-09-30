// Contexto da área de trabalho: dados carregados, busca de relacionamentos e ações globais
// (abrir formulário, abrir ficha, confirmar, executar ação com aviso).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { loadWorkspace, type Workspace } from "@/lib/data/workspace";
import type {
  Apolice,
  Cliente,
  FormTable,
  FormValues,
  Lead,
  Profile,
  Seguradora,
  Veiculo,
} from "@/lib/data/types";
import { dateBR, fillTemplate, firstName } from "@/lib/format";

export type RecordKind = "lead" | "veiculo" | "apolice" | "sinistro";
export type FormRequest = {
  table: FormTable;
  id?: string | undefined;
  initial?: FormValues | undefined;
  onSaved?: (id: string) => void;
  title?: string | undefined;
};
export type ConfirmRequest = {
  title: string;
  description?: ReactNode | undefined;
  confirmLabel?: string | undefined;
  destructive?: boolean | undefined;
  inputLabel?: string | undefined;
  inputRequired?: boolean | undefined;
};

type Lookups = {
  cliente: (id?: string | null) => Cliente | undefined;
  lead: (id?: string | null) => Lead | undefined;
  veiculo: (id?: string | null) => Veiculo | undefined;
  apolice: (id?: string | null) => Apolice | undefined;
  seguradora: (id?: string | null) => Seguradora | undefined;
  usuario: (id?: string | null) => Profile | undefined;
  clienteNome: (id?: string | null) => string;
  veiculoNome: (id?: string | null) => string;
  usuarioNome: (id?: string | null) => string;
};

type Ctx = {
  ws: Workspace;
  refresh: () => Promise<unknown>;
  openForm: (req: FormRequest) => void;
  openRecord: (kind: RecordKind, id: string) => void;
  confirm: (req: ConfirmRequest) => Promise<string | false>;
  /** Executa uma ação, mostra aviso de sucesso/erro e recarrega os dados. */
  run: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
  message: (
    chave: string,
    vars: {
      nome?: string | null | undefined;
      veiculo?: string | undefined;
      vencimento?: string | null | undefined;
    },
  ) => string;
  alertDays: number;
  get: Lookups;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace fora do WorkspaceProvider");
  return ctx;
}

export type UiState = {
  form: FormRequest | null;
  record: { kind: RecordKind; id: string } | null;
  confirm: (ConfirmRequest & { resolve: (v: string | false) => void }) | null;
};

export const WORKSPACE_KEY = ["workspace"] as const;

export function useWorkspaceQuery() {
  return useQuery({ queryKey: WORKSPACE_KEY, queryFn: loadWorkspace, retry: 1, staleTime: 30_000 });
}

export function WorkspaceProvider({
  ws,
  children,
  setUi,
}: {
  ws: Workspace;
  children: ReactNode;
  setUi: (fn: (s: UiState) => UiState) => void;
}) {
  const queryClient = useQueryClient();
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY }),
    [queryClient],
  );

  const get = useMemo<Lookups>(() => {
    const idx = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
    const c = idx(ws.clientes),
      l = idx(ws.leads),
      v = idx(ws.veiculos),
      a = idx(ws.apolices),
      s = idx(ws.seguradoras),
      u = idx(ws.profiles);
    return {
      cliente: (id) => (id ? c.get(id) : undefined),
      lead: (id) => (id ? l.get(id) : undefined),
      veiculo: (id) => (id ? v.get(id) : undefined),
      apolice: (id) => (id ? a.get(id) : undefined),
      seguradora: (id) => (id ? s.get(id) : undefined),
      usuario: (id) => (id ? u.get(id) : undefined),
      clienteNome: (id) => (id && c.get(id)?.nome) || "—",
      veiculoNome: (id) => {
        const x = id ? v.get(id) : undefined;
        return x ? `${x.marca} ${x.modelo} · ${x.placa}`.trim() : "—";
      },
      usuarioNome: (id) => (id && u.get(id)?.nome) || "—",
    };
  }, [ws]);

  const message = useCallback<Ctx["message"]>(
    (chave, vars) => {
      const tpl = ws.mensagens.find((m) => m.chave === chave)?.texto ?? "Olá, {nome}! Tudo bem?";
      return fillTemplate(tpl, {
        nome: firstName(vars.nome),
        veiculo: vars.veiculo ?? "veículo",
        vencimento: vars.vencimento ? dateBR(vars.vencimento) : "",
        corretora: ws.empresa.nome,
      });
    },
    [ws.mensagens, ws.empresa.nome],
  );

  const run = useCallback<Ctx["run"]>(
    async (action, success) => {
      try {
        await action();
        if (success) toast.success(success);
        await refresh();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
        return false;
      }
    },
    [refresh],
  );

  const value = useMemo<Ctx>(
    () => ({
      ws,
      refresh,
      get,
      message,
      run,
      alertDays: ws.empresa.dias_alerta_renovacao || 60,
      openForm: (req) => setUi((s) => ({ ...s, form: req })),
      openRecord: (kind, id) => setUi((s) => ({ ...s, record: { kind, id } })),
      confirm: (req) =>
        new Promise((resolve) => setUi((s) => ({ ...s, confirm: { ...req, resolve } }))),
    }),
    [ws, refresh, get, message, run, setUi],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useUiState() {
  return useState<UiState>({ form: null, record: null, confirm: null });
}
