import type { Tables } from "@/integrations/supabase/types";

export type Empresa = Tables<"empresas">;
export type Profile = Tables<"profiles">;
export type UserRole = Tables<"user_roles">;
export type Cliente = Tables<"clientes">;
export type Lead = Tables<"leads">;
export type Veiculo = Tables<"veiculos">;
export type Condutor = Tables<"condutores">;
export type Seguradora = Tables<"seguradoras">;
export type Apolice = Tables<"apolices">;
export type Parcela = Tables<"parcelas">;
export type Comissao = Tables<"comissoes">;
export type Tarefa = Tables<"tarefas">;
export type Contato = Tables<"historico_contatos">;
export type Sinistro = Tables<"sinistros">;
export type Documento = Tables<"documentos">;
export type Mensagem = Tables<"mensagens">;
export type Convite = Tables<"convites">;
export type Atividade = Tables<"atividades">;
export type Produtor = Tables<"produtores">;
export type ApoliceRateio = Tables<"apolice_rateio">;

/** Tabelas carregadas na área de trabalho. */
export type DataTable =
  | "clientes"
  | "leads"
  | "veiculos"
  | "condutores"
  | "seguradoras"
  | "apolices"
  | "parcelas"
  | "comissoes"
  | "tarefas"
  | "historico_contatos"
  | "sinistros"
  | "documentos"
  | "mensagens"
  | "atividades"
  | "profiles"
  | "user_roles"
  | "produtores"
  | "apolice_rateio";

/** Tabelas editáveis por formulário. */
export type FormTable =
  | "clientes"
  | "leads"
  | "veiculos"
  | "condutores"
  | "seguradoras"
  | "apolices"
  | "parcelas"
  | "comissoes"
  | "tarefas"
  | "historico_contatos"
  | "sinistros"
  | "produtores";

export type RowOf<T extends DataTable> = Tables<T>;

export type FormValues = Record<string, string | number | boolean | null | undefined>;
