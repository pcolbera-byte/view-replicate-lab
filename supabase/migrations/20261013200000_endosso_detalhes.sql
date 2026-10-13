-- =====================================================================
-- Endosso com detalhes: troca de veículo (veículo novo e anterior),
-- forma de pagamento e parcelas da diferença de prêmio, nova franquia.
-- Aditiva e idempotente. Depende de 20261013120000_operacao_corretora.sql.
-- =====================================================================

ALTER TABLE public.endossos ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL;
ALTER TABLE public.endossos ADD COLUMN IF NOT EXISTS veiculo_anterior_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL;
ALTER TABLE public.endossos ADD COLUMN IF NOT EXISTS forma_pagamento text NOT NULL DEFAULT '';
ALTER TABLE public.endossos ADD COLUMN IF NOT EXISTS parcelas_qtd integer CHECK (parcelas_qtd IS NULL OR (parcelas_qtd >= 1 AND parcelas_qtd <= 12));
ALTER TABLE public.endossos ADD COLUMN IF NOT EXISTS primeiro_vencimento date;
-- Outros dados do endosso (ex.: franquia anterior/nova, CEP de pernoite, condutor).
ALTER TABLE public.endossos ADD COLUMN IF NOT EXISTS dados jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Parcelas geradas pela diferença de prêmio de um endosso.
ALTER TABLE public.parcelas ADD COLUMN IF NOT EXISTS endosso_id uuid REFERENCES public.endossos(id) ON DELETE CASCADE;

-- Veículos do endosso sempre da mesma corretora.
DROP POLICY IF EXISTS endossos_insert ON public.endossos;
DROP POLICY IF EXISTS endossos_update ON public.endossos;
CREATE POLICY endossos_insert ON public.endossos FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id())
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (veiculo_anterior_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_anterior_id AND v.empresa_id = app_private.my_empresa_id())));
CREATE POLICY endossos_update ON public.endossos FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id())
  WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id())
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (veiculo_anterior_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_anterior_id AND v.empresa_id = app_private.my_empresa_id())));

-- Versão anterior (8 parâmetros) substituída pela versão com detalhes.
DROP FUNCTION IF EXISTS public.registrar_endosso(uuid, text, text, date, date, numeric, numeric, text);

CREATE OR REPLACE FUNCTION public.registrar_endosso(
  _apolice uuid, _tipo text, _numero text DEFAULT '', _data date DEFAULT current_date,
  _inicio date DEFAULT NULL, _premio numeric DEFAULT 0, _comissao numeric DEFAULT 0, _descricao text DEFAULT '',
  _forma text DEFAULT '', _parcelas integer DEFAULT NULL, _vencimento date DEFAULT NULL,
  _veiculo uuid DEFAULT NULL, _dados jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.apolices%ROWTYPE; _id uuid; _resp uuid; _n integer; _base integer; i integer; v numeric;
        _d jsonb := COALESCE(_dados, '{}'::jsonb); _venc date;
BEGIN
  SELECT * INTO a FROM public.apolices WHERE id = _apolice AND empresa_id = app_private.my_empresa_id();
  IF a.id IS NULL THEN RAISE EXCEPTION 'Apólice não encontrada.'; END IF;
  IF a.status = 'Cancelada' THEN RAISE EXCEPTION 'Esta apólice já está cancelada.'; END IF;
  IF _veiculo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.veiculos WHERE id = _veiculo AND empresa_id = a.empresa_id AND cliente_id = a.cliente_id) THEN
    RAISE EXCEPTION 'O veículo precisa estar cadastrado para o mesmo cliente da apólice.';
  END IF;
  IF _tipo = 'Troca de veículo' AND _veiculo IS NULL THEN RAISE EXCEPTION 'Informe o novo veículo.'; END IF;
  _n := CASE WHEN COALESCE(_premio, 0) > 0 THEN _parcelas ELSE NULL END;
  IF _n IS NOT NULL AND (_n < 1 OR _n > 12) THEN RAISE EXCEPTION 'Parcelas do endosso: de 1 a 12.'; END IF;
  -- Franquia anterior guardada junto da nova, para o histórico.
  IF _d ? 'franquia_nova' THEN _d := _d || jsonb_build_object('franquia_anterior', a.franquia); END IF;

  INSERT INTO public.endossos(empresa_id, apolice_id, numero, tipo, data_emissao, inicio_vigencia, premio_diferenca, comissao_diferenca,
                              descricao, criado_por, is_demo, veiculo_id, veiculo_anterior_id, forma_pagamento, parcelas_qtd, primeiro_vencimento, dados)
  VALUES (a.empresa_id, a.id, COALESCE(_numero, ''), _tipo, COALESCE(_data, current_date), _inicio, COALESCE(_premio, 0), COALESCE(_comissao, 0),
          COALESCE(_descricao, ''), auth.uid(), a.is_demo, _veiculo, CASE WHEN _veiculo IS NOT NULL THEN a.veiculo_id END,
          COALESCE(_forma, ''), _n, CASE WHEN _n IS NOT NULL THEN COALESCE(_vencimento, _inicio, _data, current_date) END, _d)
  RETURNING id INTO _id;

  IF _veiculo IS NOT NULL THEN
    UPDATE public.apolices SET veiculo_id = _veiculo WHERE id = a.id;
  END IF;
  IF jsonb_typeof(_d->'franquia_nova') = 'number' THEN
    UPDATE public.apolices SET franquia = (_d->>'franquia_nova')::numeric WHERE id = a.id;
  END IF;

  -- Parcelas da diferença de prêmio, numeradas depois das da apólice.
  IF _n IS NOT NULL THEN
    SELECT COALESCE(max(numero), 0) INTO _base FROM public.parcelas WHERE apolice_id = a.id;
    _venc := COALESCE(_vencimento, _inicio, _data, current_date);
    FOR i IN 1.._n LOOP
      v := CASE WHEN i = _n THEN _premio - trunc(_premio / _n, 2) * (_n - 1) ELSE trunc(_premio / _n, 2) END;
      INSERT INTO public.parcelas(empresa_id, apolice_id, endosso_id, numero, vencimento, valor, observacoes, is_demo)
      VALUES (a.empresa_id, a.id, _id, _base + i, (_venc + make_interval(months => i - 1))::date, v,
              'Endosso ' || COALESCE(NULLIF(_numero, ''), _tipo) || ' – ' || i || '/' || _n, a.is_demo);
    END LOOP;
  END IF;

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
REVOKE ALL ON FUNCTION public.registrar_endosso(uuid, text, text, date, date, numeric, numeric, text, text, integer, date, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_endosso(uuid, text, text, date, date, numeric, numeric, text, text, integer, date, uuid, jsonb) TO authenticated;

-- Excluir um endosso de troca de veículo devolve o veículo anterior à apólice
-- (se ela ainda estiver com o veículo do endosso) e a franquia anterior.
CREATE OR REPLACE FUNCTION app_private.desfazer_endosso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.veiculo_id IS NOT NULL THEN
    UPDATE public.apolices SET veiculo_id = OLD.veiculo_anterior_id
     WHERE id = OLD.apolice_id AND veiculo_id = OLD.veiculo_id;
  END IF;
  IF OLD.dados ? 'franquia_nova' THEN
    UPDATE public.apolices SET franquia = NULLIF(OLD.dados->>'franquia_anterior', '')::numeric
     WHERE id = OLD.apolice_id AND franquia IS NOT DISTINCT FROM (OLD.dados->>'franquia_nova')::numeric;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION app_private.desfazer_endosso() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS desfazer_endosso ON public.endossos;
CREATE TRIGGER desfazer_endosso BEFORE DELETE ON public.endossos FOR EACH ROW EXECUTE FUNCTION app_private.desfazer_endosso();
