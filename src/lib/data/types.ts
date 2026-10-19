import type { Tables } from "@/integrations/supabase/types";

export type Empresa = Tables<"empresas">;
export type Profile = Tables<"profiles">;
export type UserRole = Tables<"user_roles">;
// Colunas da migração de produtores. Declaradas aqui para o app compilar mesmo quando os tipos
// gerados pelo Lovable ainda não as incluem (antes da migração ser aplicada no banco).
type ComProdutor<T> = Omit<T, "produtor_id"> & { produtor_id?: string | null | undefined };

export type Cliente = ComProdutor<Tables<"clientes">>;
export type Lead = ComProdutor<Tables<"leads">>;
export type Veiculo = Tables<"veiculos">;
export type Condutor = Tables<"condutores">;
export type Seguradora = Tables<"seguradoras">;
export type Apolice = ComProdutor<Tables<"apolices">>;
export type Parcela = Tables<"parcelas">;
export type Comissao = ComProdutor<Tables<"comissoes">>;
export type Tarefa = Tables<"tarefas">;
export type Contato = Tables<"historico_contatos">;
export type Sinistro = Tables<"sinistros">;
export type Documento = Tables<"documentos">;
export type Mensagem = Tables<"mensagens">;
export type Convite = Tables<"convites">;
export type Atividade = Tables<"atividades">;
export type Produtor = {
  id: string;
  empresa_id: string;
  nome: string;
  nome_completo: string | null;
  tipo: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  percentual_padrao: number | null;
  usuario_id: string | null;
  ativo: boolean;
  observacoes: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};
export type ApoliceRateio = {
  id: string;
  empresa_id: string;
  apolice_id: string;
  produtor_id: string;
  percentual: number;
  created_at: string;
  updated_at: string;
};

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

export type FormValues = Record<string, string | number | boolean | null | undefined>;
