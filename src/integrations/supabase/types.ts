export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      apolice_rateio: {
        Row: {
          apolice_id: string
          created_at: string
          empresa_id: string
          id: string
          is_demo: boolean
          percentual: number
          produtor_id: string
          updated_at: string
        }
        Insert: {
          apolice_id: string
          created_at?: string
          empresa_id: string
          id?: string
          is_demo?: boolean
          percentual: number
          produtor_id: string
          updated_at?: string
        }
        Update: {
          apolice_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          is_demo?: boolean
          percentual?: number
          produtor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apolice_rateio_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolice_rateio_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolice_rateio_produtor_id_fkey"
            columns: ["produtor_id"]
            isOneToOne: false
            referencedRelation: "produtores"
            referencedColumns: ["id"]
          },
        ]
      }
      apolices: {
        Row: {
          apolice_anterior_id: string | null
          cliente_id: string
          comissao_percentual: number | null
          comissao_valor: number | null
          created_at: string
          empresa_id: string
          forma_pagamento: string | null
          franquia: number | null
          id: string
          inicio: string
          is_demo: boolean
          numero: string
          observacoes: string | null
          parcelas_qtd: number | null
          premio: number
          produtor_id: string | null
          ramo: string
          renovacao_obs: string | null
          renovacao_status: string
          responsavel_id: string | null
          seguradora: string
          seguradora_id: string | null
          status: string
          updated_at: string
          veiculo_id: string | null
          vencimento: string
        }
        Insert: {
          apolice_anterior_id?: string | null
          cliente_id: string
          comissao_percentual?: number | null
          comissao_valor?: number | null
          created_at?: string
          empresa_id: string
          forma_pagamento?: string | null
          franquia?: number | null
          id?: string
          inicio: string
          is_demo?: boolean
          numero: string
          observacoes?: string | null
          parcelas_qtd?: number | null
          premio?: number
          produtor_id?: string | null
          ramo?: string
          renovacao_obs?: string | null
          renovacao_status?: string
          responsavel_id?: string | null
          seguradora: string
          seguradora_id?: string | null
          status?: string
          updated_at?: string
          veiculo_id?: string | null
          vencimento: string
        }
        Update: {
          apolice_anterior_id?: string | null
          cliente_id?: string
          comissao_percentual?: number | null
          comissao_valor?: number | null
          created_at?: string
          empresa_id?: string
          forma_pagamento?: string | null
          franquia?: number | null
          id?: string
          inicio?: string
          is_demo?: boolean
          numero?: string
          observacoes?: string | null
          parcelas_qtd?: number | null
          premio?: number
          produtor_id?: string | null
          ramo?: string
          renovacao_obs?: string | null
          renovacao_status?: string
          responsavel_id?: string | null
          seguradora?: string
          seguradora_id?: string | null
          status?: string
          updated_at?: string
          veiculo_id?: string | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "apolices_apolice_anterior_id_fkey"
            columns: ["apolice_anterior_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_produtor_id_fkey"
            columns: ["produtor_id"]
            isOneToOne: false
            referencedRelation: "produtores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_seguradora_id_fkey"
            columns: ["seguradora_id"]
            isOneToOne: false
            referencedRelation: "seguradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          acao: string
          created_at: string
          descricao: string
          empresa_id: string
          entidade: string
          entidade_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string
          empresa_id: string
          entidade: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string
          data_nascimento: string | null
          documento: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          is_demo: boolean
          nome: string
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          produtor_id: string | null
          responsavel_cpf: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          rg: string | null
          telefone: string | null
          tipo: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          is_demo?: boolean
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          produtor_id?: string | null
          responsavel_cpf?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          rg?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          is_demo?: boolean
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          produtor_id?: string | null
          responsavel_cpf?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          rg?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_produtor_id_fkey"
            columns: ["produtor_id"]
            isOneToOne: false
            referencedRelation: "produtores"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          apolice_id: string
          created_at: string
          data_prevista: string
          data_recebida: string | null
          empresa_id: string
          id: string
          is_demo: boolean
          observacoes: string | null
          parcela: number | null
          percentual: number | null
          produtor_id: string | null
          responsavel_id: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          apolice_id: string
          created_at?: string
          data_prevista: string
          data_recebida?: string | null
          empresa_id: string
          id?: string
          is_demo?: boolean
          observacoes?: string | null
          parcela?: number | null
          percentual?: number | null
          produtor_id?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          apolice_id?: string
          created_at?: string
          data_prevista?: string
          data_recebida?: string | null
          empresa_id?: string
          id?: string
          is_demo?: boolean
          observacoes?: string | null
          parcela?: number | null
          percentual?: number | null
          produtor_id?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_produtor_id_fkey"
            columns: ["produtor_id"]
            isOneToOne: false
            referencedRelation: "produtores"
            referencedColumns: ["id"]
          },
        ]
      }
      condutores: {
        Row: {
          cnh: string | null
          cpf: string | null
          created_at: string
          data_habilitacao: string | null
          data_nascimento: string | null
          empresa_id: string
          estado_civil: string | null
          id: string
          is_demo: boolean
          nome: string
          relacao: string | null
          updated_at: string
          veiculo_id: string
        }
        Insert: {
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          data_habilitacao?: string | null
          data_nascimento?: string | null
          empresa_id: string
          estado_civil?: string | null
          id?: string
          is_demo?: boolean
          nome: string
          relacao?: string | null
          updated_at?: string
          veiculo_id: string
        }
        Update: {
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          data_habilitacao?: string | null
          data_nascimento?: string | null
          empresa_id?: string
          estado_civil?: string | null
          id?: string
          is_demo?: boolean
          nome?: string
          relacao?: string | null
          updated_at?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "condutores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condutores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          aceito_em: string | null
          created_at: string
          criado_por: string | null
          email: string
          empresa_id: string
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          aceito_em?: string | null
          created_at?: string
          criado_por?: string | null
          email: string
          empresa_id: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          aceito_em?: string | null
          created_at?: string
          criado_por?: string | null
          email?: string
          empresa_id?: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          apolice_id: string | null
          caminho: string
          categoria: string
          cliente_id: string | null
          created_at: string
          empresa_id: string
          enviado_por: string | null
          id: string
          nome: string
          sinistro_id: string | null
          tamanho: number | null
          tipo_mime: string | null
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          apolice_id?: string | null
          caminho: string
          categoria?: string
          cliente_id?: string | null
          created_at?: string
          empresa_id: string
          enviado_por?: string | null
          id?: string
          nome: string
          sinistro_id?: string | null
          tamanho?: number | null
          tipo_mime?: string | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          apolice_id?: string | null
          caminho?: string
          categoria?: string
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string
          enviado_por?: string | null
          id?: string
          nome?: string
          sinistro_id?: string | null
          tamanho?: number | null
          tipo_mime?: string | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          dias_alerta_renovacao: number
          email: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          dias_alerta_renovacao?: number
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          dias_alerta_renovacao?: number
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      historico_contatos: {
        Row: {
          apolice_id: string | null
          cliente_id: string | null
          created_at: string
          data: string
          descricao: string
          empresa_id: string
          id: string
          is_demo: boolean
          lead_id: string | null
          tipo: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          apolice_id?: string | null
          cliente_id?: string | null
          created_at?: string
          data?: string
          descricao: string
          empresa_id: string
          id?: string
          is_demo?: boolean
          lead_id?: string | null
          tipo?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          apolice_id?: string | null
          cliente_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          empresa_id?: string
          id?: string
          is_demo?: boolean
          lead_id?: string | null
          tipo?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_contatos_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_contatos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_contatos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cidade: string | null
          cliente_id: string | null
          created_at: string
          data_entrada: string
          documento: string | null
          email: string | null
          empresa_id: string
          id: string
          is_demo: boolean
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          produto: string | null
          produtor_id: string | null
          responsavel_id: string | null
          status: string
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          data_entrada?: string
          documento?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          is_demo?: boolean
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          produto?: string | null
          produtor_id?: string | null
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          data_entrada?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          is_demo?: boolean
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          produto?: string | null
          produtor_id?: string | null
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_produtor_id_fkey"
            columns: ["produtor_id"]
            isOneToOne: false
            referencedRelation: "produtores"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          chave: string
          created_at: string
          empresa_id: string
          id: string
          texto: string
          titulo: string
          updated_at: string
        }
        Insert: {
          chave: string
          created_at?: string
          empresa_id: string
          id?: string
          texto: string
          titulo: string
          updated_at?: string
        }
        Update: {
          chave?: string
          created_at?: string
          empresa_id?: string
          id?: string
          texto?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas: {
        Row: {
          apolice_id: string
          created_at: string
          data_pagamento: string | null
          empresa_id: string
          id: string
          is_demo: boolean
          numero: number
          observacoes: string | null
          status: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          apolice_id: string
          created_at?: string
          data_pagamento?: string | null
          empresa_id: string
          id?: string
          is_demo?: boolean
          numero: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          apolice_id?: string
          created_at?: string
          data_pagamento?: string | null
          empresa_id?: string
          id?: string
          is_demo?: boolean
          numero?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      produtores: {
        Row: {
          ativo: boolean
          created_at: string
          documento: string | null
          email: string | null
          empresa_id: string
          id: string
          is_demo: boolean
          nome: string
          nome_completo: string | null
          observacoes: string | null
          percentual_padrao: number | null
          telefone: string | null
          tipo: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          is_demo?: boolean
          nome: string
          nome_completo?: string | null
          observacoes?: string | null
          percentual_padrao?: number | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          is_demo?: boolean
          nome?: string
          nome_completo?: string | null
          observacoes?: string | null
          percentual_padrao?: number | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          empresa_id: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string
          empresa_id: string
          id: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          empresa_id?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      seguradoras: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguradoras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistros: {
        Row: {
          apolice_id: string | null
          cliente_id: string
          created_at: string
          data: string
          descricao: string | null
          empresa_id: string
          id: string
          is_demo: boolean
          local: string | null
          observacoes: string | null
          oficina: string | null
          protocolo: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          apolice_id?: string | null
          cliente_id: string
          created_at?: string
          data?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          is_demo?: boolean
          local?: string | null
          observacoes?: string | null
          oficina?: string | null
          protocolo?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          apolice_id?: string | null
          cliente_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          is_demo?: boolean
          local?: string | null
          observacoes?: string | null
          oficina?: string | null
          protocolo?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistros_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          apolice_id: string | null
          cliente_id: string | null
          created_at: string
          data: string
          descricao: string | null
          empresa_id: string
          horario: string | null
          id: string
          is_demo: boolean
          lead_id: string | null
          prioridade: string
          responsavel_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          apolice_id?: string | null
          cliente_id?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          empresa_id: string
          horario?: string | null
          id?: string
          is_demo?: boolean
          lead_id?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          apolice_id?: string | null
          cliente_id?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          empresa_id?: string
          horario?: string | null
          id?: string
          is_demo?: boolean
          lead_id?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          ano: number | null
          ano_fabricacao: number | null
          ano_modelo: number | null
          cep_circulacao: string | null
          cep_pernoite: string | null
          chassi: string | null
          cliente_id: string
          combustivel: string | null
          created_at: string
          empresa_id: string
          id: string
          is_demo: boolean
          local_guarda: string | null
          marca: string
          modelo: string
          observacoes: string | null
          placa: string
          renavam: string | null
          tipo: string | null
          updated_at: string
          uso: string | null
          valor_fipe: number | null
        }
        Insert: {
          ano?: number | null
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          cep_circulacao?: string | null
          cep_pernoite?: string | null
          chassi?: string | null
          cliente_id: string
          combustivel?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          is_demo?: boolean
          local_guarda?: string | null
          marca?: string
          modelo?: string
          observacoes?: string | null
          placa: string
          renavam?: string | null
          tipo?: string | null
          updated_at?: string
          uso?: string | null
          valor_fipe?: number | null
        }
        Update: {
          ano?: number | null
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          cep_circulacao?: string | null
          cep_pernoite?: string | null
          chassi?: string | null
          cliente_id?: string
          combustivel?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          is_demo?: boolean
          local_guarda?: string | null
          marca?: string
          modelo?: string
          observacoes?: string | null
          placa?: string
          renavam?: string | null
          tipo?: string | null
          updated_at?: string
          uso?: string | null
          valor_fipe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      converter_lead: { Args: { _lead_id: string }; Returns: string }
      definir_usuario: {
        Args: {
          _ativo: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      excluir_minha_conta: { Args: never; Returns: string }
      gerar_dados_demo: { Args: never; Returns: undefined }
      gerar_parcelas: {
        Args: { _apolice_id: string; _qtd?: number }
        Returns: number
      }
      limpar_dados_demo: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "corretor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "corretor"],
    },
  },
} as const
