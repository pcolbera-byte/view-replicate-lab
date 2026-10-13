-- =====================================================================
-- Operação completa da corretora
-- Aditiva e idempotente. Depende de 20260930150000_produtores.sql.
--   * endossos: alterações da apólice (inclusão, exclusão, troca de veículo,
--     cancelamento...) com diferença de prêmio e de comissão
--   * apolices.dados_ramo: dados próprios de cada ramo (endereço do risco,
--     beneficiários, capital segurado...)
--   * apolice_coberturas: coberturas, limites (LMI) e franquias da apólice
--   * repasses + repasse_itens: pagamento das comissões aos produtores
--   * conciliacoes: importação do extrato de comissões da seguradora;
--     comissoes.valor_recebido / conciliacao_id registram a baixa
-- =====================================================================

-- ---------- Endossos -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.endossos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  apolice_id uuid NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  numero text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'Alteração de dados' CHECK (tipo IN (
    'Alteração de dados', 'Inclusão', 'Exclusão', 'Troca de veículo', 'Alteração de cobertura',
    'Transferência', 'Cancelamento', 'Outros')),
  data_emissao date NOT NULL DEFAULT current_date,
  inicio_vigencia date,
  premio_diferenca numeric(12,2) NOT NULL DEFAULT 0,
  comissao_diferenca numeric(12,2) NOT NULL DEFAULT 0,
  descricao text NOT NULL DEFAULT '',
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS endossos_apolice ON public.endossos(apolice_id);
CREATE INDEX IF NOT EXISTS endossos_empresa_data ON public.endossos(empresa_id, data_emissao);

-- Comissão gerada pelo endosso (apagar o endosso apaga essa comissão).
ALTER TABLE public.comissoes ADD COLUMN IF NOT EXISTS endosso_id uuid REFERENCES public.endossos(id) ON DELETE CASCADE;

-- ---------- Ramos e coberturas --------------------------------------------
ALTER TABLE public.apolices ADD COLUMN IF NOT EXISTS dados_ramo jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.apolice_coberturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  apolice_id uuid NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  nome text NOT NULL,
  limite numeric(14,2),
  franquia text NOT NULL DEFAULT '',
  premio numeric(12,2),
  ordem integer NOT NULL DEFAULT 0,
  observacoes text NOT NULL DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coberturas_apolice ON public.apolice_coberturas(apolice_id, ordem);

-- ---------- Conciliação de comissões --------------------------------------
CREATE TABLE IF NOT EXISTS public.conciliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  seguradora text NOT NULL DEFAULT '',
  arquivo text NOT NULL DEFAULT '',
  data_pagamento date NOT NULL DEFAULT current_date,
  linhas integer NOT NULL DEFAULT 0,
  baixadas integer NOT NULL DEFAULT 0,
  valor_extrato numeric(14,2) NOT NULL DEFAULT 0,
  valor_baixado numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text NOT NULL DEFAULT '',
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comissoes ADD COLUMN IF NOT EXISTS valor_recebido numeric(12,2);
ALTER TABLE public.comissoes ADD COLUMN IF NOT EXISTS conciliacao_id uuid REFERENCES public.conciliacoes(id) ON DELETE SET NULL;

-- ---------- Repasse aos produtores ----------------------------------------
CREATE TABLE IF NOT EXISTS public.repasses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produtor_id uuid NOT NULL REFERENCES public.produtores(id),  -- não apaga produtor com repasse
  competencia date NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Pago')),
  pago_em date,
  forma_pagamento text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repasses_produtor ON public.repasses(empresa_id, produtor_id, competencia);

CREATE TABLE IF NOT EXISTS public.repasse_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  repasse_id uuid NOT NULL REFERENCES public.repasses(id) ON DELETE CASCADE,
  comissao_id uuid NOT NULL REFERENCES public.comissoes(id) ON DELETE CASCADE,
  base numeric(12,2) NOT NULL DEFAULT 0,
  percentual numeric(5,2) NOT NULL DEFAULT 100 CHECK (percentual >= 0 AND percentual <= 100),
  valor numeric(12,2) NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comissao_id)  -- cada comissão é repassada uma única vez
);
CREATE INDEX IF NOT EXISTS repasse_itens_repasse ON public.repasse_itens(repasse_id);

-- ---------- Permissões ---------------------------------------------------
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['endossos','apolice_coberturas','conciliacoes','repasses','repasse_itens'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;

-- Endossos e coberturas: a equipe inteira opera (como as apólices); excluir endosso só o administrador.
DROP POLICY IF EXISTS endossos_select ON public.endossos;
DROP POLICY IF EXISTS endossos_insert ON public.endossos;
DROP POLICY IF EXISTS endossos_update ON public.endossos;
DROP POLICY IF EXISTS endossos_delete ON public.endossos;
CREATE POLICY endossos_select ON public.endossos FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY endossos_insert ON public.endossos FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()));
CREATE POLICY endossos_update ON public.endossos FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id())
  WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()));
CREATE POLICY endossos_delete ON public.endossos FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());

DROP POLICY IF EXISTS coberturas_select ON public.apolice_coberturas;
DROP POLICY IF EXISTS coberturas_insert ON public.apolice_coberturas;
DROP POLICY IF EXISTS coberturas_update ON public.apolice_coberturas;
DROP POLICY IF EXISTS coberturas_delete ON public.apolice_coberturas;
CREATE POLICY coberturas_select ON public.apolice_coberturas FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY coberturas_insert ON public.apolice_coberturas FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()));
CREATE POLICY coberturas_update ON public.apolice_coberturas FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id())
  WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id()));
CREATE POLICY coberturas_delete ON public.apolice_coberturas FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id());

-- Conciliação: dinheiro da corretora, só o administrador.
DROP POLICY IF EXISTS conciliacoes_admin ON public.conciliacoes;
CREATE POLICY conciliacoes_admin ON public.conciliacoes FOR ALL TO authenticated
  USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin())
  WITH CHECK (empresa_id = app_private.my_empresa_id() AND app_private.is_admin());

-- Repasses: administrador faz tudo; o produtor com login consulta os seus.
DROP POLICY IF EXISTS repasses_select ON public.repasses;
DROP POLICY IF EXISTS repasses_admin ON public.repasses;
CREATE POLICY repasses_select ON public.repasses FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id()
  AND (app_private.is_admin() OR produtor_id IN (SELECT app_private.meus_produtores())));
CREATE POLICY repasses_admin ON public.repasses FOR ALL TO authenticated
  USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin())
  WITH CHECK (empresa_id = app_private.my_empresa_id() AND app_private.is_admin()
    AND EXISTS (SELECT 1 FROM public.produtores p WHERE p.id = produtor_id AND p.empresa_id = app_private.my_empresa_id()));

DROP POLICY IF EXISTS repasse_itens_select ON public.repasse_itens;
DROP POLICY IF EXISTS repasse_itens_admin ON public.repasse_itens;
CREATE POLICY repasse_itens_select ON public.repasse_itens FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id()
  AND (app_private.is_admin() OR repasse_id IN (SELECT r.id FROM public.repasses r WHERE r.produtor_id IN (SELECT app_private.meus_produtores()))));
CREATE POLICY repasse_itens_admin ON public.repasse_itens FOR ALL TO authenticated
  USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin())
  WITH CHECK (empresa_id = app_private.my_empresa_id() AND app_private.is_admin()
    AND EXISTS (SELECT 1 FROM public.repasses r WHERE r.id = repasse_id AND r.empresa_id = app_private.my_empresa_id())
    AND EXISTS (SELECT 1 FROM public.comissoes c WHERE c.id = comissao_id AND c.empresa_id = app_private.my_empresa_id()));

-- Vínculos novos em comissões sempre da mesma corretora.
CREATE OR REPLACE FUNCTION app_private.checar_vinculos_comissao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.endosso_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.endossos e WHERE e.id = NEW.endosso_id AND e.empresa_id = NEW.empresa_id AND e.apolice_id = NEW.apolice_id) THEN
    RAISE EXCEPTION 'Endosso inválido para esta comissão.';
  END IF;
  IF NEW.conciliacao_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conciliacoes c WHERE c.id = NEW.conciliacao_id AND c.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Conciliação inválida para esta corretora.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.checar_vinculos_comissao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS checar_vinculos_comissao ON public.comissoes;
CREATE TRIGGER checar_vinculos_comissao BEFORE INSERT OR UPDATE OF endosso_id, conciliacao_id ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION app_private.checar_vinculos_comissao();

-- ---------- Funções -------------------------------------------------------

-- Registra um endosso. Gera a comissão da diferença (se houver) e, no cancelamento,
-- cancela a apólice, as parcelas e as comissões ainda não recebidas.
CREATE OR REPLACE FUNCTION public.registrar_endosso(
  _apolice uuid, _tipo text, _numero text DEFAULT '', _data date DEFAULT current_date,
  _inicio date DEFAULT NULL, _premio numeric DEFAULT 0, _comissao numeric DEFAULT 0, _descricao text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.apolices%ROWTYPE; _id uuid; _resp uuid;
BEGIN
  SELECT * INTO a FROM public.apolices WHERE id = _apolice AND empresa_id = app_private.my_empresa_id();
  IF a.id IS NULL THEN RAISE EXCEPTION 'Apólice não encontrada.'; END IF;
  IF a.status = 'Cancelada' THEN RAISE EXCEPTION 'Esta apólice já está cancelada.'; END IF;
  INSERT INTO public.endossos(empresa_id, apolice_id, numero, tipo, data_emissao, inicio_vigencia, premio_diferenca, comissao_diferenca, descricao, criado_por, is_demo)
  VALUES (a.empresa_id, a.id, COALESCE(_numero, ''), _tipo, COALESCE(_data, current_date), _inicio, COALESCE(_premio, 0), COALESCE(_comissao, 0), COALESCE(_descricao, ''), auth.uid(), a.is_demo)
  RETURNING id INTO _id;
  IF COALESCE(_comissao, 0) <> 0 THEN
    _resp := COALESCE(a.responsavel_id, auth.uid());
    INSERT INTO public.comissoes(empresa_id, apolice_id, endosso_id, parcela, percentual, valor, data_prevista, responsavel_id, produtor_id, observacoes, is_demo)
    VALUES (a.empresa_id, a.id, _id, NULL, a.comissao_percentual, _comissao, COALESCE(_inicio, _data, current_date) + 30, _resp, a.produtor_id,
            'Endosso ' || COALESCE(NULLIF(_numero, ''), _tipo), a.is_demo);
  END IF;
  IF _tipo = 'Cancelamento' THEN
    UPDATE public.apolices SET status = 'Cancelada', renovacao_obs = COALESCE(NULLIF(_descricao, ''), renovacao_obs) WHERE id = a.id;
    UPDATE public.parcelas SET status = 'Cancelado' WHERE apolice_id = a.id AND status IN ('Pendente', 'Atrasado') AND vencimento >= COALESCE(_inicio, _data, current_date);
    UPDATE public.comissoes SET status = 'Cancelada' WHERE apolice_id = a.id AND status = 'Prevista' AND endosso_id IS DISTINCT FROM _id AND data_prevista >= COALESCE(_inicio, _data, current_date);
  END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_endosso(uuid, text, text, date, date, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_endosso(uuid, text, text, date, date, numeric, numeric, text) TO authenticated;

-- Baixa em lote das comissões conciliadas com o extrato da seguradora.
-- _itens: [{"comissao_id": "...", "valor": 123.45}]
CREATE OR REPLACE FUNCTION public.baixar_comissoes_conciliadas(
  _seguradora text, _arquivo text, _data date, _linhas integer, _valor_extrato numeric, _itens jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _emp uuid := app_private.my_empresa_id(); _id uuid; _n integer; _v numeric;
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas o administrador pode dar baixa nas comissões.'; END IF;
  IF jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'Nenhuma comissão selecionada.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_itens) i
             LEFT JOIN public.comissoes c ON c.id = (i->>'comissao_id')::uuid AND c.empresa_id = _emp
             WHERE c.id IS NULL) THEN
    RAISE EXCEPTION 'Há comissões que não pertencem à sua corretora.';
  END IF;
  INSERT INTO public.conciliacoes(empresa_id, seguradora, arquivo, data_pagamento, linhas, valor_extrato, criado_por)
  VALUES (_emp, COALESCE(_seguradora, ''), COALESCE(_arquivo, ''), COALESCE(_data, current_date), COALESCE(_linhas, 0), COALESCE(_valor_extrato, 0), auth.uid())
  RETURNING id INTO _id;
  UPDATE public.comissoes c
     SET status = 'Recebida', data_recebida = COALESCE(_data, current_date),
         valor_recebido = round((i->>'valor')::numeric, 2), conciliacao_id = _id
    FROM jsonb_array_elements(_itens) i
   WHERE c.id = (i->>'comissao_id')::uuid AND c.empresa_id = _emp;
  GET DIAGNOSTICS _n = ROW_COUNT;
  SELECT COALESCE(sum(valor_recebido), 0) INTO _v FROM public.comissoes WHERE conciliacao_id = _id;
  UPDATE public.conciliacoes SET baixadas = _n, valor_baixado = _v WHERE id = _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.baixar_comissoes_conciliadas(text, text, date, integer, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.baixar_comissoes_conciliadas(text, text, date, integer, numeric, jsonb) TO authenticated;

-- Desfaz uma conciliação: as comissões voltam para "Prevista".
CREATE OR REPLACE FUNCTION public.desfazer_conciliacao(_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas o administrador pode desfazer a conciliação.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conciliacoes WHERE id = _id AND empresa_id = app_private.my_empresa_id()) THEN
    RAISE EXCEPTION 'Conciliação não encontrada.';
  END IF;
  UPDATE public.comissoes SET status = 'Prevista', data_recebida = NULL, valor_recebido = NULL, conciliacao_id = NULL
   WHERE conciliacao_id = _id AND empresa_id = app_private.my_empresa_id();
  GET DIAGNOSTICS _n = ROW_COUNT;
  DELETE FROM public.conciliacoes WHERE id = _id;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.desfazer_conciliacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desfazer_conciliacao(uuid) TO authenticated;

-- Fecha o repasse de um produtor: cria o repasse com os itens (comissões) e o total.
-- _itens: [{"comissao_id": "...", "base": 100, "percentual": 40}]
CREATE OR REPLACE FUNCTION public.gerar_repasse(
  _produtor uuid, _competencia date, _itens jsonb, _observacoes text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _emp uuid := app_private.my_empresa_id(); _id uuid; _total numeric;
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas o administrador pode gerar repasses.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.produtores WHERE id = _produtor AND empresa_id = _emp) THEN
    RAISE EXCEPTION 'Produtor não encontrado.';
  END IF;
  IF jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'Nenhuma comissão selecionada.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_itens) i
             LEFT JOIN public.comissoes c ON c.id = (i->>'comissao_id')::uuid AND c.empresa_id = _emp
             WHERE c.id IS NULL) THEN
    RAISE EXCEPTION 'Há comissões que não pertencem à sua corretora.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_itens) i JOIN public.repasse_itens ri ON ri.comissao_id = (i->>'comissao_id')::uuid) THEN
    RAISE EXCEPTION 'Alguma comissão já foi incluída em outro repasse.';
  END IF;
  INSERT INTO public.repasses(empresa_id, produtor_id, competencia, observacoes, criado_por)
  VALUES (_emp, _produtor, date_trunc('month', _competencia)::date, COALESCE(_observacoes, ''), auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.repasse_itens(empresa_id, repasse_id, comissao_id, base, percentual, valor)
  SELECT _emp, _id, (i->>'comissao_id')::uuid, round((i->>'base')::numeric, 2), (i->>'percentual')::numeric,
         round((i->>'base')::numeric * (i->>'percentual')::numeric / 100, 2)
    FROM jsonb_array_elements(_itens) i;
  SELECT COALESCE(sum(valor), 0) INTO _total FROM public.repasse_itens WHERE repasse_id = _id;
  UPDATE public.repasses SET valor = _total WHERE id = _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.gerar_repasse(uuid, date, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_repasse(uuid, date, jsonb, text) TO authenticated;
