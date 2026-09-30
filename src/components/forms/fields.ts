// Definição declarativa dos formulários de cada cadastro.
import * as D from "@/lib/domain";
import { addYears } from "@/lib/format";
import type { FormTable, FormValues } from "@/lib/data/types";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "time"
  | "number"
  | "money"
  | "percent"
  | "textarea"
  | "select"
  | "document"
  | "cep"
  | "plate"
  | "cliente"
  | "lead"
  | "veiculo"
  | "apolice"
  | "seguradora"
  | "usuario"
  | "section"
  | "checkbox";

export type Field = {
  key: string;
  label: string;
  type?: FieldType | undefined;
  options?: readonly string[] | undefined;
  required?: boolean | undefined;
  wide?: boolean | undefined;
  placeholder?: string | undefined;
  hint?: string | undefined;
  show?: (v: FormValues) => boolean;
  /** Campo usado apenas na criação */
  createOnly?: boolean | undefined;
};

const isPF = (v: FormValues) => (v["tipo"] ?? "PF") === "PF";
const isPJ = (v: FormValues) => v["tipo"] === "PJ";

export const FORM_FIELDS: Record<FormTable, Field[]> = {
  clientes: [
    { key: "tipo", label: "Tipo de pessoa", type: "select", options: ["PF", "PJ"], required: true },
    { key: "responsavel_id", label: "Corretor responsável", type: "usuario" },
    { key: "nome", label: "Nome completo", required: true, wide: true, show: isPF },
    { key: "nome", label: "Razão social", required: true, wide: true, show: isPJ },
    { key: "nome_fantasia", label: "Nome fantasia", show: isPJ },
    { key: "documento", label: "CPF", type: "document", show: isPF },
    { key: "documento", label: "CNPJ", type: "document", show: isPJ },
    { key: "rg", label: "RG", show: isPF },
    { key: "data_nascimento", label: "Data de nascimento", type: "date", show: isPF },
    { key: "estado_civil", label: "Estado civil", type: "select", options: D.MARITAL, show: isPF },
    { key: "responsavel_nome", label: "Responsável na empresa", show: isPJ },
    { key: "responsavel_cpf", label: "CPF do responsável", type: "document", show: isPJ },
    { key: "_contato", label: "Contato", type: "section" },
    { key: "whatsapp", label: "WhatsApp", type: "tel" },
    { key: "telefone", label: "Telefone", type: "tel" },
    { key: "email", label: "E-mail", type: "email", wide: true },
    { key: "_endereco", label: "Endereço", type: "section" },
    { key: "cep", label: "CEP", type: "cep", hint: "Preenche o endereço automaticamente" },
    { key: "endereco", label: "Logradouro" },
    { key: "numero", label: "Número" },
    { key: "complemento", label: "Complemento" },
    { key: "bairro", label: "Bairro" },
    { key: "cidade", label: "Cidade" },
    { key: "estado", label: "UF", type: "select", options: D.UF },
    { key: "observacoes", label: "Observações", type: "textarea", wide: true },
  ],
  leads: [
    { key: "nome", label: "Nome", required: true, wide: true },
    { key: "documento", label: "CPF / CNPJ", type: "document" },
    { key: "whatsapp", label: "WhatsApp", type: "tel" },
    { key: "telefone", label: "Telefone", type: "tel" },
    { key: "email", label: "E-mail", type: "email" },
    { key: "cidade", label: "Cidade" },
    { key: "produto", label: "Produto de interesse", type: "select", options: D.PRODUCTS },
    { key: "origem", label: "Origem", type: "select", options: D.LEAD_ORIGINS, required: true },
    { key: "data_entrada", label: "Data de entrada", type: "date" },
    { key: "responsavel_id", label: "Corretor responsável", type: "usuario" },
    { key: "status", label: "Etapa", type: "select", options: D.LEAD_STAGES, required: true },
    {
      key: "motivo_perda",
      label: "Motivo da perda",
      show: (v) => v["status"] === "Perdido",
      wide: true,
    },
    { key: "observacoes", label: "Observações", type: "textarea", wide: true },
  ],
  veiculos: [
    {
      key: "cliente_id",
      label: "Cliente (proprietário)",
      type: "cliente",
      required: true,
      wide: true,
    },
    { key: "placa", label: "Placa", type: "plate", required: true },
    { key: "tipo", label: "Tipo", type: "select", options: D.VEHICLE_TYPES },
    { key: "marca", label: "Marca", required: true },
    { key: "modelo", label: "Modelo", required: true },
    { key: "ano_fabricacao", label: "Ano de fabricação", type: "number" },
    { key: "ano_modelo", label: "Ano modelo", type: "number" },
    { key: "valor_fipe", label: "Valor FIPE (R$)", type: "money" },
    { key: "combustivel", label: "Combustível", type: "select", options: D.FUELS },
    { key: "renavam", label: "Renavam" },
    { key: "chassi", label: "Chassi" },
    { key: "_uso", label: "Uso e guarda", type: "section" },
    { key: "uso", label: "Uso", type: "select", options: D.VEHICLE_USE },
    { key: "local_guarda", label: "Local de guarda", type: "select", options: D.GARAGE },
    { key: "cep_circulacao", label: "CEP de circulação", type: "cep" },
    { key: "cep_pernoite", label: "CEP de pernoite", type: "cep" },
    { key: "observacoes", label: "Observações", type: "textarea", wide: true },
  ],
  condutores: [
    { key: "nome", label: "Nome", required: true, wide: true },
    { key: "cpf", label: "CPF", type: "document" },
    { key: "data_nascimento", label: "Data de nascimento", type: "date" },
    { key: "cnh", label: "CNH" },
    { key: "data_habilitacao", label: "Data de habilitação", type: "date" },
    { key: "estado_civil", label: "Estado civil", type: "select", options: D.MARITAL },
    {
      key: "relacao",
      label: "Relação com o proprietário",
      type: "select",
      options: ["Próprio segurado", "Cônjuge", "Filho(a)", "Pai/Mãe", "Funcionário", "Outro"],
    },
  ],
  seguradoras: [
    { key: "nome", label: "Nome", required: true, wide: true },
    { key: "cnpj", label: "CNPJ", type: "document" },
    { key: "ativo", label: "Ativa", type: "checkbox" },
  ],
  apolices: [
    { key: "cliente_id", label: "Cliente", type: "cliente", required: true, wide: true },
    {
      key: "veiculo_id",
      label: "Veículo",
      type: "veiculo",
      wide: true,
      hint: "Somente veículos do cliente selecionado",
    },
    { key: "ramo", label: "Ramo", type: "select", options: D.RAMOS, required: true },
    { key: "seguradora_id", label: "Seguradora", type: "seguradora", required: true },
    { key: "numero", label: "Número da apólice", required: true },
    { key: "status", label: "Situação", type: "select", options: D.POLICY_STATUS, required: true },
    { key: "inicio", label: "Início da vigência", type: "date", required: true },
    { key: "vencimento", label: "Fim da vigência", type: "date", required: true },
    { key: "_valores", label: "Valores e pagamento", type: "section" },
    { key: "premio", label: "Prêmio total (R$)", type: "money", required: true },
    { key: "franquia", label: "Franquia (R$)", type: "money" },
    {
      key: "forma_pagamento",
      label: "Forma de pagamento",
      type: "select",
      options: D.PAYMENT_METHODS,
    },
    { key: "parcelas_qtd", label: "Número de parcelas", type: "number" },
    {
      key: "_gerar_parcelas",
      label: "Gerar parcelas e comissões previstas ao salvar",
      type: "checkbox",
      createOnly: true,
      wide: true,
    },
    { key: "_comissao", label: "Comissão", type: "section" },
    { key: "responsavel_id", label: "Corretor responsável", type: "usuario" },
    { key: "comissao_percentual", label: "Comissão (%)", type: "percent" },
    {
      key: "comissao_valor",
      label: "Comissão (R$)",
      type: "money",
      hint: "Deixe vazio para calcular pelo percentual",
    },
    { key: "observacoes", label: "Observações", type: "textarea", wide: true },
  ],
  parcelas: [
    { key: "numero", label: "Nº da parcela", type: "number", required: true },
    { key: "vencimento", label: "Vencimento", type: "date", required: true },
    { key: "valor", label: "Valor (R$)", type: "money", required: true },
    {
      key: "status",
      label: "Situação",
      type: "select",
      options: D.INSTALLMENT_STATUS,
      required: true,
    },
    { key: "data_pagamento", label: "Data de pagamento", type: "date" },
    { key: "observacoes", label: "Observações", type: "textarea", wide: true },
  ],
  comissoes: [
    { key: "apolice_id", label: "Apólice", type: "apolice", required: true, wide: true },
    { key: "parcela", label: "Parcela", type: "number" },
    { key: "percentual", label: "Percentual (%)", type: "percent" },
    { key: "valor", label: "Valor (R$)", type: "money", required: true },
    { key: "data_prevista", label: "Data prevista", type: "date", required: true },
    { key: "data_recebida", label: "Data recebida", type: "date" },
    {
      key: "status",
      label: "Situação",
      type: "select",
      options: D.COMMISSION_STATUS,
      required: true,
    },
    { key: "responsavel_id", label: "Corretor", type: "usuario" },
    { key: "observacoes", label: "Observações", type: "textarea", wide: true },
  ],
  tarefas: [
    { key: "titulo", label: "Assunto", required: true, wide: true },
    { key: "tipo", label: "Tipo", type: "select", options: D.TASK_TYPES, required: true },
    {
      key: "prioridade",
      label: "Prioridade",
      type: "select",
      options: D.TASK_PRIORITY,
      required: true,
    },
    { key: "data", label: "Data", type: "date", required: true },
    { key: "horario", label: "Horário", type: "time" },
    { key: "cliente_id", label: "Cliente", type: "cliente" },
    { key: "lead_id", label: "Lead", type: "lead" },
    { key: "responsavel_id", label: "Responsável", type: "usuario" },
    { key: "status", label: "Situação", type: "select", options: D.TASK_STATUS, required: true },
    { key: "descricao", label: "Descrição", type: "textarea", wide: true },
  ],
  historico_contatos: [
    {
      key: "tipo",
      label: "Tipo de contato",
      type: "select",
      options: D.CONTACT_TYPES,
      required: true,
    },
    { key: "data", label: "Data", type: "date", required: true },
    { key: "cliente_id", label: "Cliente", type: "cliente" },
    { key: "lead_id", label: "Lead", type: "lead" },
    {
      key: "descricao",
      label: "O que foi conversado",
      type: "textarea",
      required: true,
      wide: true,
    },
  ],
  sinistros: [
    { key: "cliente_id", label: "Cliente", type: "cliente", required: true, wide: true },
    { key: "veiculo_id", label: "Veículo", type: "veiculo" },
    { key: "apolice_id", label: "Apólice", type: "apolice" },
    { key: "tipo", label: "Tipo", type: "select", options: D.CLAIM_TYPES, required: true },
    { key: "data", label: "Data da ocorrência", type: "date", required: true },
    { key: "status", label: "Situação", type: "select", options: D.CLAIM_STATUS, required: true },
    { key: "protocolo", label: "Protocolo na seguradora" },
    { key: "local", label: "Local" },
    { key: "oficina", label: "Oficina" },
    { key: "responsavel_id", label: "Responsável", type: "usuario" },
    { key: "descricao", label: "Descrição", type: "textarea", wide: true },
    { key: "observacoes", label: "Observações internas", type: "textarea", wide: true },
  ],
};

export const FORM_TITLES: Record<FormTable, string> = {
  clientes: "cliente",
  leads: "lead",
  veiculos: "veículo",
  condutores: "condutor",
  seguradoras: "seguradora",
  apolices: "apólice",
  parcelas: "parcela",
  comissoes: "comissão",
  tarefas: "tarefa",
  historico_contatos: "contato",
  sinistros: "sinistro",
};

export const FEMININE: Partial<Record<FormTable, boolean>> = {
  seguradoras: true,
  apolices: true,
  parcelas: true,
  comissoes: true,
  tarefas: true,
};

/** Valores iniciais para novos registros. */
export function defaultsFor(table: FormTable, userId: string, today: string): FormValues {
  switch (table) {
    case "clientes":
      return { tipo: "PF", responsavel_id: userId };
    case "leads":
      return {
        status: "Novo",
        origem: "WhatsApp",
        produto: "Seguro Auto",
        data_entrada: today,
        responsavel_id: userId,
      };
    case "veiculos":
      return { tipo: "Automóvel", combustivel: "Flex", uso: "Particular" };
    case "apolices":
      return {
        status: "Vigente",
        ramo: "Auto",
        inicio: today,
        vencimento: addYears(today, 1),
        responsavel_id: userId,
        parcelas_qtd: 1,
        _gerar_parcelas: true,
      };
    case "tarefas":
      return {
        status: "Pendente",
        prioridade: "Normal",
        tipo: "Ligação",
        data: today,
        responsavel_id: userId,
      };
    case "historico_contatos":
      return { tipo: "WhatsApp", data: today };
    case "sinistros":
      return { status: "Aberto", data: today, responsavel_id: userId };
    case "parcelas":
      return { status: "Pendente" };
    case "comissoes":
      return { status: "Prevista", responsavel_id: userId };
    case "seguradoras":
      return { ativo: true };
    default:
      return {};
  }
}
