-- =====================================================================
-- Corretor360 — Gestão da corretora (V1 completa)
-- Migração ADITIVA: não altera as migrações anteriores já aplicadas.
--   * Completa cadastros (PF/PJ, veículo, apólice) e prepara multiproduto (ramo)
--   * Seguradoras, condutores, parcelas, comissões, documentos, mensagens
--   * Convites: novos usuários entram na corretora de quem convidou
--   * Perfis admin/corretor aplicados nas políticas RLS
--   * Log de atividades, renovação vinculada, dados de demonstração
-- =====================================================================

-- ---------- Funções auxiliares ----------------------------------------
-- Usuário desativado deixa de enxergar qualquer dado (my_empresa_id vira NULL).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text DEFAULT '';

CREATE OR REPLACE FUNCTION app_private.my_empresa_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT empresa_id FROM public.profiles WHERE id = auth.uid() AND ativo $$;

CREATE OR REPLACE FUNCTION app_private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT app_private.my_empresa_id() IS NOT NULL AND app_private.has_role(auth.uid(), 'admin') $$;
REVOKE ALL ON FUNCTION app_private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_admin() TO authenticated;

-- ---------- Empresa -----------------------------------------------------
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cnpj text DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco text DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS dias_alerta_renovacao integer NOT NULL DEFAULT 60 CHECK (dias_alerta_renovacao BETWEEN 7 AND 180);

-- ---------- Clientes (PF/PJ completos) ----------------------------------
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nome_fantasia text DEFAULT '',
  ADD COLUMN IF NOT EXISTS rg text DEFAULT '',
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS estado_civil text DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsavel_nome text DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsavel_cpf text DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero text DEFAULT '',
  ADD COLUMN IF NOT EXISTS complemento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- ---------- Leads --------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS data_entrada date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS motivo_perda text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- ---------- Veículos -----------------------------------------------------
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS ano_fabricacao integer,
  ADD COLUMN IF NOT EXISTS ano_modelo integer,
  ADD COLUMN IF NOT EXISTS valor_fipe numeric(12,2),
  ADD COLUMN IF NOT EXISTS cep_circulacao text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep_pernoite text DEFAULT '',
  ADD COLUMN IF NOT EXISTS local_guarda text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
UPDATE public.veiculos SET ano_modelo = ano WHERE ano_modelo IS NULL AND ano IS NOT NULL;

-- ---------- Seguradoras --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seguradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cnpj text DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

-- ---------- Apólices -----------------------------------------------------
ALTER TABLE public.apolices
  ADD COLUMN IF NOT EXISTS ramo text NOT NULL DEFAULT 'Auto',
  ADD COLUMN IF NOT EXISTS seguradora_id uuid REFERENCES public.seguradoras(id),
  ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS parcelas_qtd integer CHECK (parcelas_qtd IS NULL OR parcelas_qtd BETWEEN 1 AND 24),
  ADD COLUMN IF NOT EXISTS comissao_valor numeric(12,2),
  ADD COLUMN IF NOT EXISTS responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS apolice_anterior_id uuid REFERENCES public.apolices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS renovacao_status text NOT NULL DEFAULT 'Pendente',
  ADD COLUMN IF NOT EXISTS renovacao_obs text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
-- Uma apólice só pode ser renovada por uma única nova apólice (sem renovação duplicada).
CREATE UNIQUE INDEX IF NOT EXISTS apolices_renovacao_unica ON public.apolices(apolice_anterior_id) WHERE apolice_anterior_id IS NOT NULL;

-- ---------- Tarefas, histórico, sinistros --------------------------------
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS apolice_id uuid REFERENCES public.apolices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.historico_contatos
  ADD COLUMN IF NOT EXISTS data date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS apolice_id uuid REFERENCES public.apolices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.sinistros
  ADD COLUMN IF NOT EXISTS responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- ---------- Condutores ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.condutores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text DEFAULT '',
  data_nascimento date,
  cnh text DEFAULT '',
  data_habilitacao date,
  estado_civil text DEFAULT '',
  relacao text DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Parcelas -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  apolice_id uuid NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero > 0),
  vencimento date NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Pago','Atrasado','Cancelado')),
  data_pagamento date,
  observacoes text DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (apolice_id, numero)
);

-- ---------- Comissões ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  apolice_id uuid NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  parcela integer,
  percentual numeric(5,2),
  valor numeric(12,2) NOT NULL DEFAULT 0,
  data_prevista date NOT NULL,
  data_recebida date,
  status text NOT NULL DEFAULT 'Prevista' CHECK (status IN ('Prevista','Recebida','Cancelada')),
  responsavel_id uuid,
  observacoes text DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Documentos (arquivo no Storage, metadados aqui) --------------
CREATE TABLE IF NOT EXISTS public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  apolice_id uuid REFERENCES public.apolices(id) ON DELETE SET NULL,
  sinistro_id uuid REFERENCES public.sinistros(id) ON DELETE SET NULL,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'Outro',
  caminho text NOT NULL UNIQUE,
  tamanho bigint,
  tipo_mime text DEFAULT '',
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Modelos de mensagem (WhatsApp) -------------------------------
CREATE TABLE IF NOT EXISTS public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave text NOT NULL,
  titulo text NOT NULL,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, chave)
);

-- ---------- Convites (entrada de novos usuários na corretora) ------------
CREATE TABLE IF NOT EXISTS public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email text NOT NULL,
  nome text DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'corretor',
  criado_por uuid,
  aceito_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS convites_email_pendente ON public.convites (lower(email)) WHERE aceito_em IS NULL;
CREATE INDEX IF NOT EXISTS convites_empresa ON public.convites(empresa_id, email);

-- ---------- Atividades (linha do tempo + log de alterações) --------------
CREATE TABLE IF NOT EXISTS public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid,
  entidade text NOT NULL,
  entidade_id uuid,
  acao text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Permissões e RLS ---------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['seguradoras','condutores','parcelas','comissoes','documentos','mensagens','convites'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;
GRANT SELECT ON public.atividades TO authenticated;
GRANT ALL ON public.atividades TO service_role;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

-- Tabelas operacionais: toda a equipe lê e edita dentro da própria corretora;
-- EXCLUIR é restrito ao administrador. Recria as políticas "FOR ALL" antigas.
DROP POLICY IF EXISTS clientes_empresa ON public.clientes;
DROP POLICY IF EXISTS leads_empresa ON public.leads;
DROP POLICY IF EXISTS veiculos_empresa ON public.veiculos;
DROP POLICY IF EXISTS apolices_empresa ON public.apolices;
DROP POLICY IF EXISTS tarefas_empresa ON public.tarefas;
DROP POLICY IF EXISTS historico_empresa ON public.historico_contatos;
DROP POLICY IF EXISTS sinistros_empresa ON public.sinistros;

-- clientes
CREATE POLICY clientes_select ON public.clientes FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY clientes_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id());
CREATE POLICY clientes_update ON public.clientes FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id());
CREATE POLICY clientes_delete ON public.clientes FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- leads
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id() AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id())));
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id() AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id())));
CREATE POLICY leads_delete ON public.leads FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- veiculos
CREATE POLICY veiculos_select ON public.veiculos FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY veiculos_insert ON public.veiculos FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id() AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id()));
CREATE POLICY veiculos_update ON public.veiculos FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id() AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id()));
CREATE POLICY veiculos_delete ON public.veiculos FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- apolices
CREATE POLICY apolices_select ON public.apolices FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY apolices_insert ON public.apolices FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id())
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.cliente_id = apolices.cliente_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (seguradora_id IS NULL OR EXISTS (SELECT 1 FROM public.seguradoras s WHERE s.id = seguradora_id AND s.empresa_id = app_private.my_empresa_id()))
  AND (apolices.apolice_anterior_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolices.apolice_anterior_id AND a.empresa_id = app_private.my_empresa_id() AND a.id <> apolices.id)));
CREATE POLICY apolices_update ON public.apolices FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id())
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.cliente_id = apolices.cliente_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (seguradora_id IS NULL OR EXISTS (SELECT 1 FROM public.seguradoras s WHERE s.id = seguradora_id AND s.empresa_id = app_private.my_empresa_id()))
  AND (apolices.apolice_anterior_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolices.apolice_anterior_id AND a.empresa_id = app_private.my_empresa_id() AND a.id <> apolices.id)));
CREATE POLICY apolices_delete ON public.apolices FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- tarefas
CREATE POLICY tarefas_select ON public.tarefas FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY tarefas_insert ON public.tarefas FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id()))
  AND (lead_id IS NULL OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.empresa_id = app_private.my_empresa_id()))
  AND (apolice_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id())));
CREATE POLICY tarefas_update ON public.tarefas FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id()))
  AND (lead_id IS NULL OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.empresa_id = app_private.my_empresa_id()))
  AND (apolice_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id())));
-- tarefas podem ser excluídas por quem as criou/é responsável ou pelo admin
CREATE POLICY tarefas_delete ON public.tarefas FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND (app_private.is_admin() OR responsavel_id = auth.uid()));
-- historico_contatos
CREATE POLICY historico_select ON public.historico_contatos FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY historico_insert ON public.historico_contatos FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id()))
  AND (lead_id IS NULL OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.empresa_id = app_private.my_empresa_id()))
  AND (apolice_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id())));
CREATE POLICY historico_update ON public.historico_contatos FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND (usuario_id = auth.uid() OR app_private.is_admin())) WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id()))
  AND (lead_id IS NULL OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.empresa_id = app_private.my_empresa_id()))
  AND (apolice_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()))
  AND (usuario_id = auth.uid() OR app_private.is_admin()));
CREATE POLICY historico_delete ON public.historico_contatos FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- sinistros
CREATE POLICY sinistros_select ON public.sinistros FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY sinistros_insert ON public.sinistros FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id())
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.cliente_id = sinistros.cliente_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (apolice_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.cliente_id = sinistros.cliente_id AND a.empresa_id = app_private.my_empresa_id())));
CREATE POLICY sinistros_update ON public.sinistros FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id())
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.cliente_id = sinistros.cliente_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (apolice_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.cliente_id = sinistros.cliente_id AND a.empresa_id = app_private.my_empresa_id())));
CREATE POLICY sinistros_delete ON public.sinistros FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- condutores
CREATE POLICY condutores_select ON public.condutores FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY condutores_insert ON public.condutores FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id() AND EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.empresa_id = app_private.my_empresa_id()));
CREATE POLICY condutores_update ON public.condutores FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id() AND EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.empresa_id = app_private.my_empresa_id()));
CREATE POLICY condutores_delete ON public.condutores FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- parcelas
CREATE POLICY parcelas_select ON public.parcelas FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY parcelas_insert ON public.parcelas FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id() AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()));
CREATE POLICY parcelas_update ON public.parcelas FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id() AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()));
CREATE POLICY parcelas_delete ON public.parcelas FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- comissoes: administrador vê e gerencia todas; corretor vê apenas as suas
CREATE POLICY comissoes_select ON public.comissoes FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id() AND (app_private.is_admin() OR responsavel_id = auth.uid()));
CREATE POLICY comissoes_insert ON public.comissoes FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id() AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()) AND (app_private.is_admin() OR responsavel_id = auth.uid()));
CREATE POLICY comissoes_update ON public.comissoes FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin()) WITH CHECK (empresa_id = app_private.my_empresa_id() AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()));
CREATE POLICY comissoes_delete ON public.comissoes FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
-- documentos
CREATE POLICY documentos_select ON public.documentos FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY documentos_insert ON public.documentos FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id() AND enviado_por = auth.uid() AND caminho LIKE (app_private.my_empresa_id()::text || '/%')
  AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id()))
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (apolice_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()))
  AND (sinistro_id IS NULL OR EXISTS (SELECT 1 FROM public.sinistros s WHERE s.id = sinistro_id AND s.empresa_id = app_private.my_empresa_id())));
CREATE OR REPLACE FUNCTION app_private.proteger_documento() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF NEW.empresa_id <> OLD.empresa_id OR NEW.caminho <> OLD.caminho OR NEW.enviado_por IS DISTINCT FROM OLD.enviado_por OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Não é permitido mudar a origem do arquivo'; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION app_private.proteger_documento() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER proteger_documento BEFORE UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION app_private.proteger_documento();
CREATE POLICY documentos_update ON public.documentos FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND (app_private.is_admin() OR enviado_por = auth.uid())) WITH CHECK (empresa_id = app_private.my_empresa_id() AND caminho LIKE (app_private.my_empresa_id()::text || '/%')
  AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id()))
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (apolice_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()))
  AND (sinistro_id IS NULL OR EXISTS (SELECT 1 FROM public.sinistros s WHERE s.id = sinistro_id AND s.empresa_id = app_private.my_empresa_id())));
CREATE POLICY documentos_delete ON public.documentos FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND (app_private.is_admin() OR enviado_por = auth.uid()));
-- configurações: equipe lê, administrador altera
CREATE POLICY seguradoras_select ON public.seguradoras FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY seguradoras_admin ON public.seguradoras FOR ALL TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin()) WITH CHECK (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
CREATE POLICY mensagens_select ON public.mensagens FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY mensagens_admin ON public.mensagens FOR ALL TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin()) WITH CHECK (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
CREATE POLICY convites_admin ON public.convites FOR ALL TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin()) WITH CHECK (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());
CREATE POLICY atividades_select ON public.atividades FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());

-- Usuários: todos da corretora podem ver os papéis da equipe (para exibir nomes/perfis)
DROP POLICY IF EXISTS roles_view ON public.user_roles;
CREATE POLICY roles_view ON public.user_roles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.empresa_id = app_private.my_empresa_id()));
-- O usuário continua podendo editar apenas o próprio nome/telefone; "ativo" só via função de admin.
DROP POLICY IF EXISTS profiles_edit ON public.profiles;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (nome, telefone) ON public.profiles TO authenticated;
CREATE POLICY profiles_edit ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() AND empresa_id = app_private.my_empresa_id()) WITH CHECK (id = auth.uid() AND empresa_id = app_private.my_empresa_id());
-- Empresa: apenas admin altera (colunas de identificação)
REVOKE INSERT, UPDATE ON public.empresas FROM authenticated;
GRANT UPDATE (nome, cnpj, telefone, whatsapp, email, endereco, logo_url, dias_alerta_renovacao) ON public.empresas TO authenticated;

-- ---------- Modelos de mensagem padrão -----------------------------------
CREATE OR REPLACE FUNCTION app_private.criar_mensagens_padrao(_empresa uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.mensagens (empresa_id, chave, titulo, texto) VALUES
    (_empresa, 'primeiro_contato', 'Primeiro contato', 'Olá, {nome}! Tudo bem? Recebi seu contato e estou à disposição para ajudá-lo.'),
    (_empresa, 'renovacao', 'Renovação', 'Olá, {nome}! O seguro do seu {veiculo} está próximo do vencimento ({vencimento}). Posso verificar a renovação para você?'),
    (_empresa, 'documento', 'Documentos', 'Olá, {nome}! Para concluirmos o processo, precisamos de alguns documentos.'),
    (_empresa, 'pos_venda', 'Pós-venda', 'Olá, {nome}! Sua apólice já está ativa. Qualquer dúvida, conte comigo.'),
    (_empresa, 'sinistro', 'Sinistro', 'Olá, {nome}! Estou acompanhando seu sinistro junto à seguradora e aviso assim que houver novidades.')
  ON CONFLICT (empresa_id, chave) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION app_private.criar_mensagens_padrao(uuid) FROM PUBLIC, anon, authenticated;
SELECT app_private.criar_mensagens_padrao(id) FROM public.empresas;

-- ---------- Cadastro de usuário: respeita convite --------------------------
-- Sem convite: cria corretora nova e o usuário é administrador.
-- Com convite pendente para o e-mail: entra na corretora que convidou, com o perfil do convite.
CREATE OR REPLACE FUNCTION app_private.bootstrap_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa uuid; v_role public.app_role := 'admin'; v_convite public.convites%ROWTYPE; v_nome text;
BEGIN
  SELECT * INTO v_convite FROM public.convites WHERE lower(email) = lower(NEW.email) AND aceito_em IS NULL ORDER BY created_at DESC LIMIT 1;
  v_nome := COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome',''), NULLIF(NEW.raw_user_meta_data->>'full_name',''), NULLIF(v_convite.nome,''), split_part(COALESCE(NEW.email,''),'@',1));
  IF v_convite.id IS NOT NULL THEN
    v_empresa := v_convite.empresa_id; v_role := v_convite.role;
    UPDATE public.convites SET aceito_em = now() WHERE id = v_convite.id;
  ELSE
    INSERT INTO public.empresas(nome) VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'empresa',''), 'Minha corretora')) RETURNING id INTO v_empresa;
    PERFORM app_private.criar_mensagens_padrao(v_empresa);
  END IF;
  INSERT INTO public.profiles(id, empresa_id, nome, email) VALUES (NEW.id, v_empresa, v_nome, COALESCE(NEW.email,''));
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.bootstrap_user() FROM PUBLIC, anon, authenticated;

-- ---------- Administração de usuários (RPC) -------------------------------
CREATE OR REPLACE FUNCTION public.definir_usuario(_user_id uuid, _role public.app_role, _ativo boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem alterar usuários.'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar o próprio perfil ou status.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND empresa_id = app_private.my_empresa_id()) THEN
    RAISE EXCEPTION 'Usuário não encontrado nesta corretora.';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role);
  UPDATE public.profiles SET ativo = _ativo WHERE id = _user_id;
END $$;
REVOKE ALL ON FUNCTION public.definir_usuario(uuid, public.app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_usuario(uuid, public.app_role, boolean) TO authenticated;

-- ---------- Renovação: nova apólice vinculada encerra a anterior ---------
CREATE OR REPLACE FUNCTION app_private.apolice_renovada() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.apolice_anterior_id IS NOT NULL THEN
    UPDATE public.apolices SET status = 'Renovada', renovacao_status = 'Renovada'
    WHERE id = NEW.apolice_anterior_id AND empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END $$;
GRANT EXECUTE ON FUNCTION app_private.apolice_renovada() TO authenticated;
CREATE TRIGGER apolice_renovada AFTER INSERT ON public.apolices FOR EACH ROW EXECUTE FUNCTION app_private.apolice_renovada();

-- ---------- Parcelas e comissões geradas a partir da apólice --------------
-- Divide o prêmio em N parcelas mensais a partir do início e cria uma comissão prevista por parcela.
CREATE OR REPLACE FUNCTION public.gerar_parcelas(_apolice_id uuid, _qtd integer DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.apolices%ROWTYPE; n integer; i integer; v_valor numeric(12,2); v_ultimo numeric(12,2); v_com numeric(12,2); v_com_total numeric(12,2);
BEGIN
  SELECT * INTO a FROM public.apolices WHERE id = _apolice_id AND empresa_id = app_private.my_empresa_id();
  IF a.id IS NULL THEN RAISE EXCEPTION 'Apólice não encontrada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.parcelas WHERE apolice_id = a.id) THEN RAISE EXCEPTION 'Esta apólice já possui parcelas.'; END IF;
  n := COALESCE(_qtd, a.parcelas_qtd, 1);
  IF n < 1 OR n > 24 THEN RAISE EXCEPTION 'Quantidade de parcelas inválida.'; END IF;
  v_valor := trunc(a.premio / n, 2);
  v_ultimo := a.premio - v_valor * (n - 1);
  v_com_total := COALESCE(a.comissao_valor, round(a.premio * COALESCE(a.comissao_percentual,0) / 100, 2));
  FOR i IN 1..n LOOP
    INSERT INTO public.parcelas(empresa_id, apolice_id, numero, vencimento, valor, is_demo)
    VALUES (a.empresa_id, a.id, i, (a.inicio + make_interval(months => i - 1))::date, CASE WHEN i = n THEN v_ultimo ELSE v_valor END, a.is_demo);
    IF v_com_total > 0 THEN
      v_com := CASE WHEN i = n THEN v_com_total - trunc(v_com_total / n, 2) * (n - 1) ELSE trunc(v_com_total / n, 2) END;
      INSERT INTO public.comissoes(empresa_id, apolice_id, parcela, percentual, valor, data_prevista, responsavel_id, is_demo)
      VALUES (a.empresa_id, a.id, i, a.comissao_percentual, v_com, (a.inicio + make_interval(months => i - 1) + interval '30 days')::date, COALESCE(a.responsavel_id, auth.uid()), a.is_demo);
    END IF;
  END LOOP;
  UPDATE public.apolices SET parcelas_qtd = n WHERE id = a.id;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.gerar_parcelas(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_parcelas(uuid, integer) TO authenticated;

-- ---------- Conversão de lead em cliente (atômica, preserva histórico) ----
CREATE OR REPLACE FUNCTION public.converter_lead(_lead_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE l public.leads%ROWTYPE; v_cliente uuid;
BEGIN
  SELECT * INTO l FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado.'; END IF;
  IF l.cliente_id IS NOT NULL THEN RETURN l.cliente_id; END IF;
  INSERT INTO public.clientes(empresa_id, tipo, nome, documento, telefone, whatsapp, email, cidade, observacoes, responsavel_id, is_demo)
  VALUES (l.empresa_id, CASE WHEN length(regexp_replace(COALESCE(l.documento,''), '\D', '', 'g')) = 14 THEN 'PJ' ELSE 'PF' END,
          l.nome, l.documento, l.telefone, l.whatsapp, l.email, l.cidade, l.observacoes, COALESCE(l.responsavel_id, auth.uid()), l.is_demo)
  RETURNING id INTO v_cliente;
  UPDATE public.leads SET cliente_id = v_cliente, status = 'Vendido' WHERE id = l.id;
  UPDATE public.historico_contatos SET cliente_id = v_cliente WHERE lead_id = l.id AND cliente_id IS NULL;
  UPDATE public.tarefas SET cliente_id = v_cliente WHERE lead_id = l.id AND cliente_id IS NULL;
  INSERT INTO public.historico_contatos(empresa_id, cliente_id, lead_id, tipo, descricao, usuario_id, is_demo)
  VALUES (l.empresa_id, v_cliente, l.id, 'Sistema', 'Lead convertido em cliente.', auth.uid(), l.is_demo);
  RETURN v_cliente;
END $$;
REVOKE ALL ON FUNCTION public.converter_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.converter_lead(uuid) TO authenticated;

-- ---------- Log de atividades (gatilho genérico) --------------------------
CREATE OR REPLACE FUNCTION app_private.registrar_atividade() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j jsonb := to_jsonb(NEW); v_acao text; v_desc text;
BEGIN
  IF COALESCE((j->>'is_demo')::boolean, false) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criado';
  ELSIF (to_jsonb(OLD)->>'status') IS DISTINCT FROM (j->>'status') THEN
    v_acao := 'status';
  ELSE
    RETURN NEW;
  END IF;
  v_desc := CASE TG_TABLE_NAME
    WHEN 'clientes' THEN 'Novo cliente: ' || (j->>'nome')
    WHEN 'leads' THEN CASE WHEN v_acao = 'criado' THEN 'Novo lead: ' || (j->>'nome') ELSE 'Lead ' || (j->>'nome') || ' → ' || (j->>'status') END
    WHEN 'veiculos' THEN 'Veículo cadastrado: ' || COALESCE(j->>'marca','') || ' ' || COALESCE(j->>'modelo','') || ' · ' || (j->>'placa')
    WHEN 'apolices' THEN CASE WHEN v_acao = 'criado' THEN 'Apólice cadastrada: ' || (j->>'numero') || ' · ' || (j->>'seguradora') ELSE 'Apólice ' || (j->>'numero') || ' → ' || (j->>'status') END
    WHEN 'sinistros' THEN CASE WHEN v_acao = 'criado' THEN 'Sinistro aberto: ' || (j->>'tipo') ELSE 'Sinistro atualizado → ' || (j->>'status') END
    WHEN 'documentos' THEN 'Documento adicionado: ' || (j->>'nome')
    ELSE TG_TABLE_NAME
  END;
  INSERT INTO public.atividades(empresa_id, usuario_id, entidade, entidade_id, acao, descricao)
  VALUES ((j->>'empresa_id')::uuid, auth.uid(), TG_TABLE_NAME, (j->>'id')::uuid, v_acao, v_desc);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.registrar_atividade() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER registrar_atividade AFTER INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
CREATE TRIGGER registrar_atividade AFTER INSERT OR UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
CREATE TRIGGER registrar_atividade AFTER INSERT ON public.veiculos FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
CREATE TRIGGER registrar_atividade AFTER INSERT OR UPDATE OF status ON public.apolices FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
CREATE TRIGGER registrar_atividade AFTER INSERT OR UPDATE OF status ON public.sinistros FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
CREATE TRIGGER registrar_atividade AFTER INSERT ON public.documentos FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();

-- ---------- Dados de demonstração ----------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_dados_demo() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e uuid := app_private.my_empresa_id();
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem limpar os dados de demonstração.'; END IF;
  DELETE FROM public.comissoes WHERE empresa_id = e AND is_demo;
  DELETE FROM public.parcelas WHERE empresa_id = e AND is_demo;
  DELETE FROM public.historico_contatos WHERE empresa_id = e AND is_demo;
  DELETE FROM public.tarefas WHERE empresa_id = e AND is_demo;
  DELETE FROM public.sinistros WHERE empresa_id = e AND is_demo;
  DELETE FROM public.condutores WHERE empresa_id = e AND is_demo;
  UPDATE public.apolices SET apolice_anterior_id = NULL WHERE empresa_id = e AND is_demo;
  DELETE FROM public.apolices WHERE empresa_id = e AND is_demo;
  DELETE FROM public.veiculos WHERE empresa_id = e AND is_demo;
  DELETE FROM public.leads WHERE empresa_id = e AND is_demo;
  DELETE FROM public.clientes WHERE empresa_id = e AND is_demo;
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'Há registros reais vinculados a dados de demonstração. Desvincule-os antes de limpar.';
END $$;
REVOKE ALL ON FUNCTION public.limpar_dados_demo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_dados_demo() TO authenticated;

CREATE OR REPLACE FUNCTION public.gerar_dados_demo() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e uuid := app_private.my_empresa_id(); u uuid := auth.uid();
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
  v1 uuid; v2 uuid; v3 uuid; v4 uuid; v5 uuid; v6 uuid; v7 uuid; v8 uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; a6 uuid;
  s_porto uuid; s_allianz uuid; s_tokio uuid; s_hdi uuid; s_azul uuid;
  l1 uuid; d date := CURRENT_DATE;
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem gerar dados de demonstração.'; END IF;
  IF EXISTS (SELECT 1 FROM public.clientes WHERE empresa_id = e AND is_demo) THEN RAISE EXCEPTION 'Os dados de demonstração já existem.'; END IF;

  INSERT INTO public.seguradoras(empresa_id, nome) VALUES (e,'Porto Seguro'),(e,'Allianz'),(e,'Tokio Marine'),(e,'HDI'),(e,'Azul Seguros') ON CONFLICT (empresa_id, nome) DO NOTHING;
  SELECT id INTO s_porto FROM public.seguradoras WHERE empresa_id = e AND nome = 'Porto Seguro';
  SELECT id INTO s_allianz FROM public.seguradoras WHERE empresa_id = e AND nome = 'Allianz';
  SELECT id INTO s_tokio FROM public.seguradoras WHERE empresa_id = e AND nome = 'Tokio Marine';
  SELECT id INTO s_hdi FROM public.seguradoras WHERE empresa_id = e AND nome = 'HDI';
  SELECT id INTO s_azul FROM public.seguradoras WHERE empresa_id = e AND nome = 'Azul Seguros';

  INSERT INTO public.clientes(empresa_id,tipo,nome,documento,whatsapp,telefone,email,cidade,estado,bairro,responsavel_id,is_demo) VALUES (e,'PF','[DEMO] Mariana Costa','123.456.789-09','11987654321','1133334444','mariana@exemplo.com','São Paulo','SP','Moema',u,true) RETURNING id INTO c1;
  INSERT INTO public.clientes(empresa_id,tipo,nome,documento,whatsapp,email,cidade,estado,bairro,responsavel_id,is_demo) VALUES (e,'PF','[DEMO] Ricardo Almeida','987.654.321-00','11976543210','ricardo@exemplo.com','Santo André','SP','Centro',u,true) RETURNING id INTO c2;
  INSERT INTO public.clientes(empresa_id,tipo,nome,nome_fantasia,documento,responsavel_nome,whatsapp,email,cidade,estado,responsavel_id,is_demo) VALUES (e,'PJ','[DEMO] Transportes Horizonte Ltda','Horizonte Log','12.345.678/0001-95','Paulo Mendes','11965432109','frota@exemplo.com','Guarulhos','SP',u,true) RETURNING id INTO c3;
  INSERT INTO public.clientes(empresa_id,tipo,nome,documento,whatsapp,email,cidade,estado,responsavel_id,is_demo) VALUES (e,'PF','[DEMO] Fernanda Lima','456.789.123-45','21998765432','fernanda@exemplo.com','Rio de Janeiro','RJ',u,true) RETURNING id INTO c4;
  INSERT INTO public.clientes(empresa_id,tipo,nome,documento,whatsapp,email,cidade,estado,responsavel_id,is_demo) VALUES (e,'PF','[DEMO] João Pereira','321.654.987-11','31987651234','joao@exemplo.com','Belo Horizonte','MG',u,true) RETURNING id INTO c5;

  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,local_guarda,is_demo) VALUES (e,c1,'BRA2E19','Toyota','Corolla XEi',2022,2023,2023,142000,'Automóvel','Flex','Particular','Garagem fechada',true) RETURNING id INTO v1;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c2,'FTR4B21','Honda','HR-V EXL',2021,2021,2021,118000,'Automóvel','Flex','Particular',true) RETURNING id INTO v2;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c3,'QWE1A23','Volkswagen','Delivery 11.180',2020,2020,2020,265000,'Caminhão','Diesel','Comercial',true) RETURNING id INTO v3;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c3,'RTY5C67','Fiat','Fiorino Endurance',2023,2023,2023,98000,'Automóvel','Flex','Comercial',true) RETURNING id INTO v4;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c4,'KJH8D90','Jeep','Compass Longitude',2022,2022,2022,155000,'Automóvel','Flex','Particular',true) RETURNING id INTO v5;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c4,'MNB3F45','Honda','CG 160 Titan',2023,2024,2024,19500,'Moto','Flex','Particular',true) RETURNING id INTO v6;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c5,'PLO9G87','Hyundai','HB20 Comfort',2020,2021,2021,72000,'Automóvel','Flex','Aplicativo',true) RETURNING id INTO v7;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c1,'ZXC6H54','Renault','Kwid Zen',2021,2022,2022,58000,'Automóvel','Flex','Particular',true) RETURNING id INTO v8;

  INSERT INTO public.condutores(empresa_id,veiculo_id,nome,cpf,cnh,relacao,is_demo) VALUES (e,v1,'[DEMO] Mariana Costa','123.456.789-09','01234567890','Próprio segurado',true),(e,v1,'[DEMO] Lucas Costa','111.222.333-44','09876543210','Cônjuge',true);

  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c1,v1,'Porto Seguro',s_porto,'DEMO-0531.001',d - 360,d + 5,3890,4200,15,'Cartão de crédito',4,u,true) RETURNING id INTO a1;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c2,v2,'Allianz',s_allianz,'DEMO-5177.020',d - 353,d + 12,3120,3600,18,'Boleto',3,u,true) RETURNING id INTO a2;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c3,v3,'Tokio Marine',s_tokio,'DEMO-8820.114',d - 340,d + 25,9850,12000,12,'Débito em conta',6,u,true) RETURNING id INTO a3;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c4,v5,'HDI',s_hdi,'DEMO-3310.557',d - 120,d + 245,4410,5100,15,'Cartão de crédito',10,u,true) RETURNING id INTO a4;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c5,v7,'Azul Seguros',s_azul,'DEMO-7702.009',d - 320,d + 45,2680,2900,20,'Boleto',1,u,true) RETURNING id INTO a5;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,status,is_demo) VALUES (e,c1,v8,'Porto Seguro',s_porto,'DEMO-0531.087',d - 370,d - 5,1980,2300,15,'Boleto',1,u,'Vigente',true) RETURNING id INTO a6;

  PERFORM public.gerar_parcelas(a1); PERFORM public.gerar_parcelas(a2); PERFORM public.gerar_parcelas(a3);
  PERFORM public.gerar_parcelas(a4); PERFORM public.gerar_parcelas(a5);
  UPDATE public.parcelas SET status = 'Pago', data_pagamento = vencimento WHERE empresa_id = e AND is_demo AND vencimento < d - 10;
  UPDATE public.comissoes SET status = 'Recebida', data_recebida = data_prevista WHERE empresa_id = e AND is_demo AND data_prevista < d - 5;

  INSERT INTO public.leads(empresa_id,nome,whatsapp,email,cidade,produto,origem,status,responsavel_id,data_entrada,is_demo) VALUES (e,'[DEMO] Camila Rocha','11955554444','camila@exemplo.com','São Paulo','Seguro Auto','Instagram','Novo',u,d,true) RETURNING id INTO l1;
  INSERT INTO public.leads(empresa_id,nome,whatsapp,cidade,produto,origem,status,responsavel_id,data_entrada,is_demo) VALUES
    (e,'[DEMO] Bruno Teixeira','11944443333','Osasco','Seguro Auto','Indicação','Contato',u,d-3,true),
    (e,'[DEMO] Aline Souza','11933332222','São Paulo','Seguro Moto','Google','Proposta',u,d-6,true),
    (e,'[DEMO] Marcos Vieira','19922221111','Campinas','Seguro Auto','Site','Negociação',u,d-9,true);

  INSERT INTO public.tarefas(empresa_id,cliente_id,apolice_id,titulo,tipo,data,horario,prioridade,responsavel_id,is_demo) VALUES
    (e,c1,a1,'Enviar proposta de renovação','Renovação',d,'09:30','Urgente',u,true),
    (e,c2,a2,'Ligar para confirmar dados do veículo','Ligação',d,'11:00','Alta',u,true),
    (e,c3,NULL,'Solicitar CRLV da frota','Documento',d+1,'14:00','Normal',u,true),
    (e,c4,NULL,'Pós-venda: confirmar recebimento da apólice','Pós-venda',d-1,'10:00','Normal',u,true);
  INSERT INTO public.tarefas(empresa_id,lead_id,titulo,tipo,data,horario,prioridade,responsavel_id,is_demo) VALUES (e,l1,'Primeiro contato com lead','WhatsApp',d,'16:00','Alta',u,true);

  INSERT INTO public.historico_contatos(empresa_id,cliente_id,tipo,descricao,usuario_id,data,is_demo) VALUES
    (e,c1,'WhatsApp','Cliente solicitou renovação.',u,d-2,true),
    (e,c1,'Ligação','Apresentada proposta de renovação.',u,d-1,true),
    (e,c3,'E-mail','Enviada relação de documentos da frota.',u,d-4,true);

  INSERT INTO public.sinistros(empresa_id,cliente_id,veiculo_id,apolice_id,tipo,data,protocolo,local,oficina,descricao,status,responsavel_id,is_demo) VALUES
    (e,c2,v2,a2,'Colisão',d-12,'SIN-2026-0441','Av. Industrial, Santo André','Oficina Centro Auto','Colisão traseira em semáforo.','Em reparo',u,true),
    (e,c4,v5,a4,'Vidros',d-3,'SIN-2026-0502','Rio de Janeiro','','Troca de para-brisa.','Documentação',u,true);
END $$;
REVOKE ALL ON FUNCTION public.gerar_dados_demo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_dados_demo() TO authenticated;

-- ---------- Storage: bucket privado de documentos -------------------------
-- Estrutura de caminho: <empresa_id>/<uuid>-<nome-do-arquivo>
-- O bucket privado 'documentos' foi criado pela ferramenta de armazenamento do Lovable Cloud.
CREATE POLICY documentos_storage_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = app_private.my_empresa_id()::text);
CREATE POLICY documentos_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND (storage.foldername(name))[1] = app_private.my_empresa_id()::text);
CREATE POLICY documentos_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = app_private.my_empresa_id()::text
    AND (app_private.is_admin() OR owner = auth.uid()));

-- ---------- Índices ------------------------------------------------------
CREATE INDEX IF NOT EXISTS parcelas_empresa_venc ON public.parcelas(empresa_id, vencimento);
CREATE INDEX IF NOT EXISTS comissoes_empresa_prev ON public.comissoes(empresa_id, data_prevista);
CREATE INDEX IF NOT EXISTS documentos_cliente ON public.documentos(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS atividades_empresa_data ON public.atividades(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS condutores_veiculo ON public.condutores(veiculo_id);
CREATE INDEX IF NOT EXISTS historico_cliente ON public.historico_contatos(empresa_id, cliente_id, data DESC);
