// Dados próprios de cada ramo de seguro (gravados em apolices.dados_ramo) e sugestões de
// coberturas. Os campos aparecem no cadastro da apólice conforme o ramo escolhido.
import type { Apolice } from "@/lib/data/types";
import { dateBR, money } from "@/lib/format";

export type TipoCampoRamo = "text" | "money" | "number" | "date" | "textarea" | "select";
export type CampoRamo = {
  key: string;
  label: string;
  type?: TipoCampoRamo | undefined;
  options?: readonly string[] | undefined;
  wide?: boolean | undefined;
  hint?: string | undefined;
};
export type GrupoRamo =
  | "auto"
  | "residencial"
  | "empresarial"
  | "vida"
  | "previdencia"
  | "saude"
  | "viagem"
  | "rc"
  | "fianca"
  | "equipamentos"
  | "engenharia"
  | "capitalizacao"
  | "outros";

export function grupoDoRamo(ramo: string | null | undefined): GrupoRamo {
  switch ((ramo ?? "").trim()) {
    case "Auto":
    case "Moto":
    case "Caminhão":
      return "auto";
    case "Residencial":
    case "Condomínio":
      return "residencial";
    case "Empresarial":
      return "empresarial";
    case "Vida":
    case "Funeral":
      return "vida";
    case "Previdência":
      return "previdencia";
    case "Saúde":
      return "saude";
    case "Viagem":
      return "viagem";
    case "Responsabilidade civil":
      return "rc";
    case "Fiança locatícia":
      return "fianca";
    case "Equipamentos":
    case "Celular":
      return "equipamentos";
    case "Riscos de engenharia":
      return "engenharia";
    case "Capitalização":
      return "capitalizacao";
    default:
      return "outros";
  }
}

const enderecoRisco: CampoRamo[] = [
  { key: "endereco_risco", label: "Endereço do risco", wide: true },
  { key: "cep_risco", label: "CEP do risco" },
  { key: "cidade_risco", label: "Cidade/UF do risco" },
];

export const CAMPOS_RAMO: Record<GrupoRamo, CampoRamo[]> = {
  auto: [
    { key: "classe_bonus", label: "Classe de bônus", type: "number" },
    { key: "ci", label: "Código de identificação (CI)" },
    {
      key: "tipo_franquia",
      label: "Tipo de franquia",
      type: "select",
      options: ["Normal", "Reduzida", "Majorada", "Isenta"],
    },
  ],
  residencial: [
    ...enderecoRisco,
    {
      key: "tipo_imovel",
      label: "Tipo de imóvel",
      type: "select",
      options: ["Casa", "Apartamento", "Casa em condomínio", "Sobrado", "Condomínio"],
    },
    { key: "uso_imovel", label: "Uso", type: "select", options: ["Habitual", "Veraneio"] },
    {
      key: "construcao",
      label: "Construção",
      type: "select",
      options: ["Alvenaria", "Mista", "Madeira"],
    },
    { key: "valor_risco", label: "Valor do imóvel (R$)", type: "money" },
  ],
  empresarial: [
    ...enderecoRisco,
    { key: "atividade", label: "Atividade da empresa", wide: true },
    { key: "area_m2", label: "Área construída (m²)", type: "number" },
    { key: "funcionarios", label: "Funcionários", type: "number" },
    { key: "valor_risco", label: "Valor em risco (R$)", type: "money" },
  ],
  vida: [
    {
      key: "modalidade",
      label: "Modalidade",
      type: "select",
      options: ["Individual", "Em grupo", "Prestamista", "Funeral"],
    },
    { key: "capital_segurado", label: "Capital segurado (R$)", type: "money" },
    { key: "profissao", label: "Profissão do segurado" },
    { key: "vidas", label: "Vidas seguradas", type: "number" },
    {
      key: "beneficiarios",
      label: "Beneficiários",
      type: "textarea",
      wide: true,
      hint: "Um por linha: nome – parentesco – %",
    },
  ],
  previdencia: [
    { key: "plano", label: "Plano", type: "select", options: ["PGBL", "VGBL"] },
    { key: "contribuicao", label: "Contribuição mensal (R$)", type: "money" },
    { key: "aporte_inicial", label: "Aporte inicial (R$)", type: "money" },
    {
      key: "tributacao",
      label: "Tributação",
      type: "select",
      options: ["Progressiva", "Regressiva"],
    },
    {
      key: "beneficiarios",
      label: "Beneficiários",
      type: "textarea",
      wide: true,
      hint: "Um por linha: nome – parentesco – %",
    },
  ],
  saude: [
    { key: "plano", label: "Plano / produto" },
    {
      key: "acomodacao",
      label: "Acomodação",
      type: "select",
      options: ["Enfermaria", "Apartamento"],
    },
    {
      key: "abrangencia",
      label: "Abrangência",
      type: "select",
      options: ["Municipal", "Grupo de municípios", "Estadual", "Nacional"],
    },
    {
      key: "contratacao",
      label: "Contratação",
      type: "select",
      options: ["Individual/familiar", "Por adesão", "Empresarial (PME)"],
    },
    { key: "vidas", label: "Vidas", type: "number" },
    { key: "coparticipacao", label: "Coparticipação", type: "select", options: ["Sim", "Não"] },
  ],
  viagem: [
    { key: "destino", label: "Destino", wide: true },
    { key: "data_ida", label: "Ida", type: "date" },
    { key: "data_volta", label: "Volta", type: "date" },
    { key: "viajantes", label: "Viajantes", type: "number" },
    {
      key: "motivo",
      label: "Motivo",
      type: "select",
      options: ["Lazer", "Negócios", "Estudos", "Intercâmbio"],
    },
  ],
  rc: [
    { key: "atividade", label: "Profissão / atividade", wide: true },
    { key: "registro", label: "Registro profissional (CRM, CREA, OAB…)" },
    { key: "lmi", label: "Limite máximo de indenização (R$)", type: "money" },
    { key: "retroatividade", label: "Data de retroatividade", type: "date" },
  ],
  fianca: [
    { key: "endereco_risco", label: "Endereço do imóvel alugado", wide: true },
    { key: "locador", label: "Locador / proprietário" },
    { key: "imobiliaria", label: "Imobiliária" },
    { key: "valor_aluguel", label: "Aluguel mensal (R$)", type: "money" },
    { key: "encargos", label: "Encargos mensais (R$)", type: "money" },
  ],
  equipamentos: [
    { key: "equipamento", label: "Equipamento", wide: true },
    { key: "marca_modelo", label: "Marca / modelo" },
    { key: "numero_serie", label: "Nº de série / IMEI" },
    { key: "valor_equipamento", label: "Valor do equipamento (R$)", type: "money" },
  ],
  engenharia: [
    { key: "obra", label: "Descrição da obra", wide: true },
    { key: "endereco_risco", label: "Endereço da obra", wide: true },
    { key: "valor_obra", label: "Valor da obra (R$)", type: "money" },
    { key: "termino_obra", label: "Término previsto", type: "date" },
  ],
  capitalizacao: [
    { key: "valor_titulo", label: "Valor do título (R$)", type: "money" },
    {
      key: "modalidade",
      label: "Modalidade",
      type: "select",
      options: ["Tradicional", "Garantia de aluguel", "Instrumento de garantia", "Popular"],
    },
    { key: "sorteios", label: "Sorteios" },
  ],
  outros: [
    { key: "bem_segurado", label: "Bem / interesse segurado", wide: true },
    { key: "valor_risco", label: "Valor em risco (R$)", type: "money" },
  ],
};

export const COBERTURAS_SUGERIDAS: Record<GrupoRamo, string[]> = {
  auto: [
    "Casco (colisão, incêndio e roubo)",
    "RCF – danos materiais",
    "RCF – danos corporais",
    "Danos morais",
    "APP – morte",
    "APP – invalidez",
    "Assistência 24 horas",
    "Carro reserva",
    "Vidros, faróis e retrovisores",
  ],
  residencial: [
    "Incêndio, raio e explosão",
    "Danos elétricos",
    "Vendaval, granizo e fumaça",
    "Roubo e furto qualificado",
    "Responsabilidade civil familiar",
    "Perda ou pagamento de aluguel",
    "Quebra de vidros",
    "Assistência 24 horas",
  ],
  empresarial: [
    "Incêndio, raio e explosão",
    "Danos elétricos",
    "Vendaval, granizo e fumaça",
    "Roubo de bens",
    "Lucros cessantes",
    "Responsabilidade civil operações",
    "Equipamentos eletrônicos",
    "Quebra de vidros",
  ],
  vida: [
    "Morte",
    "Morte acidental",
    "Invalidez permanente por acidente (IPA)",
    "Invalidez funcional por doença (IFPD)",
    "Doenças graves",
    "Diária por incapacidade temporária (DIT)",
    "Auxílio funeral",
  ],
  previdencia: ["Renda vitalícia", "Pecúlio por morte", "Pensão"],
  saude: ["Consultas e exames", "Internação", "Obstetrícia", "Odontológico", "Remoção"],
  viagem: [
    "Despesas médicas e hospitalares",
    "Bagagem extraviada",
    "Cancelamento de viagem",
    "Regresso sanitário",
    "Morte acidental",
  ],
  rc: ["Responsabilidade civil profissional", "Custos de defesa", "Danos morais"],
  fianca: ["Aluguel", "Condomínio", "IPTU", "Danos ao imóvel", "Pintura"],
  equipamentos: ["Roubo e furto qualificado", "Danos acidentais", "Quebra de tela"],
  engenharia: [
    "Obras civis em construção",
    "Responsabilidade civil cruzada",
    "Erro de projeto",
    "Equipamentos de obra",
  ],
  capitalizacao: [],
  outros: [],
};

/** Formata um valor do dado do ramo para exibição. */
export function valorCampo(c: CampoRamo, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (c.type === "money") return money(Number(v));
  if (c.type === "date") return dateBR(String(v));
  return String(v);
}

/** Pares rótulo/valor preenchidos dos dados do ramo da apólice. */
export function dadosDoRamo(a: Pick<Apolice, "ramo" | "dados_ramo">): [string, string][] {
  const dados = (a.dados_ramo ?? {}) as Record<string, unknown>;
  return CAMPOS_RAMO[grupoDoRamo(a.ramo)]
    .map((c) => [c.label, valorCampo(c, dados[c.key])] as [string, string])
    .filter(([, v]) => v);
}

/** Descrição curta do bem segurado quando não há veículo (para listas e relatórios). */
export function resumoDoRamo(a: Pick<Apolice, "ramo" | "dados_ramo">): string {
  const d = (a.dados_ramo ?? {}) as Record<string, unknown>;
  const s = (k: string) => (d[k] ? String(d[k]) : "");
  const g = grupoDoRamo(a.ramo);
  const det =
    g === "residencial" || g === "empresarial" || g === "fianca"
      ? s("endereco_risco")
      : g === "vida"
        ? d["capital_segurado"]
          ? `capital ${money(Number(d["capital_segurado"]))}`
          : ""
        : g === "viagem"
          ? s("destino")
          : g === "equipamentos"
            ? [s("equipamento"), s("marca_modelo")].filter(Boolean).join(" ")
            : g === "rc"
              ? s("atividade")
              : g === "engenharia"
                ? s("obra")
                : g === "saude" || g === "previdencia"
                  ? s("plano")
                  : g === "outros"
                    ? s("bem_segurado")
                    : "";
  return [a.ramo, det].filter(Boolean).join(" – ");
}
