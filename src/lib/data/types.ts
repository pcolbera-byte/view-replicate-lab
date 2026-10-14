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
// Colunas da migração 20261013120000_operacao_corretora (mesmo motivo acima).
type ComOperacao<T> = T & {
  dados_ramo?: Record<string, unknown> | null | undefined;
  // Migração 20261013230000_premio_liquido
  premio_liquido?: number | null | undefined;
  adicional_fracionamento?: number | null | undefined;
  custo_apolice?: number | null | undefined;
  iof?: number | null | undefined;
};
export type Apolice = ComOperacao<ComProdutor<Tables<"apolices">>>;
export type Parcela = Tables<"parcelas"> & { endosso_id?: string | null | undefined };
export type Comissao = ComProdutor<Tables<"comissoes">> & {
  endosso_id?: string | null | undefined;
  valor_recebido?: number | null | undefined;
  conciliacao_id?: string | null | undefined;
};
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

export const ENDOSSO_TIPOS = [
  "Alteração de dados",
  "Inclusão",
  "Exclusão",
  "Troca de veículo",
  "Alteração de cobertura",
  "Transferência",
  "Cancelamento",
  "Outros",
] as const;
export type Endosso = {
  id: string;
  empresa_id: string;
  apolice_id: string;
  numero: string;
  tipo: string;
  data_emissao: string;
  inicio_vigencia: string | null;
  premio_diferenca: number;
  comissao_diferenca: number;
  descricao: string;
  criado_por: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  // Migração 20261013200000_endosso_detalhes
  veiculo_id?: string | null | undefined;
  veiculo_anterior_id?: string | null | undefined;
  forma_pagamento?: string | undefined;
  parcelas_qtd?: number | null | undefined;
  primeiro_vencimento?: string | null | undefined;
  dados?: Record<string, unknown> | undefined;
};
export type Cobertura = {
  id: string;
  empresa_id: string;
  apolice_id: string;
  nome: string;
  limite: number | null;
  franquia: string;
  premio: number | null;
  ordem: number;
  observacoes: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};
export type Repasse = {
  id: string;
  empresa_id: string;
  produtor_id: string;
  competencia: string;
  valor: number;
  status: "Aberto" | "Pago";
  pago_em: string | null;
  forma_pagamento: string;
  observacoes: string;
  criado_por: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};
export type RepasseItem = {
  id: string;
  empresa_id: string;
  repasse_id: string;
  comissao_id: string;
  base: number;
  percentual: number;
  valor: number;
  created_at: string;
};
export type Conciliacao = {
  id: string;
  empresa_id: string;
  seguradora: string;
  arquivo: string;
  data_pagamento: string;
  linhas: number;
  baixadas: number;
  valor_extrato: number;
  valor_baixado: number;
  observacoes: string;
  criado_por: string | null;
  created_at: string;
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
  | "apolice_rateio"
  | "endossos"
  | "apolice_coberturas"
  | "repasses"
  | "repasse_itens"
  | "conciliacoes";

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
