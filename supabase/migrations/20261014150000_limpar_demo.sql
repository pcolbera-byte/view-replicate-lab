-- =====================================================================
-- Limpar dados de demonstração: remove os clientes de demonstração com TUDO o que
-- estiver ligado a eles (apólices, veículos, parcelas, comissões, endossos, tarefas,
-- contatos, sinistros, documentos), mesmo que algo tenha sido criado depois por um
-- usuário. Registros reais de outros clientes que apontavam para dados de
-- demonstração (renovação, lead convertido) só perdem o vínculo.
-- Aditiva e idempotente. Depende de 20261013200000_endosso_detalhes.sql.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.limpar_dados_demo() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e uuid := app_private.my_empresa_id();
  cli uuid[]; apo uuid[]; vei uuid[]; lea uuid[]; sin uuid[]; p uuid;
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem limpar os dados de demonstração.'; END IF;
  SELECT COALESCE(array_agg(id), '{}') INTO cli FROM public.clientes WHERE empresa_id = e AND is_demo;
  SELECT COALESCE(array_agg(id), '{}') INTO apo FROM public.apolices WHERE empresa_id = e AND (is_demo OR cliente_id = ANY(cli));
  SELECT COALESCE(array_agg(id), '{}') INTO vei FROM public.veiculos WHERE empresa_id = e AND (is_demo OR cliente_id = ANY(cli));
  SELECT COALESCE(array_agg(id), '{}') INTO lea FROM public.leads WHERE empresa_id = e AND is_demo;
  SELECT COALESCE(array_agg(id), '{}') INTO sin FROM public.sinistros
   WHERE empresa_id = e AND (is_demo OR cliente_id = ANY(cli) OR apolice_id = ANY(apo) OR veiculo_id = ANY(vei));

  -- Registros reais que só apontam para algo de demonstração: perdem o vínculo.
  UPDATE public.apolices SET apolice_anterior_id = NULL WHERE empresa_id = e AND apolice_anterior_id = ANY(apo);
  UPDATE public.apolices SET veiculo_id = NULL WHERE empresa_id = e AND veiculo_id = ANY(vei) AND NOT (id = ANY(apo));
  UPDATE public.leads SET cliente_id = NULL WHERE empresa_id = e AND cliente_id = ANY(cli) AND NOT (id = ANY(lea));

  DELETE FROM public.documentos WHERE empresa_id = e
    AND (cliente_id = ANY(cli) OR apolice_id = ANY(apo) OR veiculo_id = ANY(vei) OR sinistro_id = ANY(sin));
  DELETE FROM public.historico_contatos WHERE empresa_id = e
    AND (is_demo OR cliente_id = ANY(cli) OR apolice_id = ANY(apo) OR lead_id = ANY(lea));
  DELETE FROM public.tarefas WHERE empresa_id = e
    AND (is_demo OR cliente_id = ANY(cli) OR apolice_id = ANY(apo) OR lead_id = ANY(lea));
  DELETE FROM public.sinistros WHERE id = ANY(sin);
  DELETE FROM public.comissoes WHERE empresa_id = e AND (is_demo OR apolice_id = ANY(apo));
  DELETE FROM public.parcelas WHERE empresa_id = e AND (is_demo OR apolice_id = ANY(apo));
  DELETE FROM public.apolice_rateio WHERE empresa_id = e AND (is_demo OR apolice_id = ANY(apo));
  DELETE FROM public.endossos WHERE empresa_id = e AND (is_demo OR apolice_id = ANY(apo));
  DELETE FROM public.apolice_coberturas WHERE empresa_id = e AND (is_demo OR apolice_id = ANY(apo));
  DELETE FROM public.condutores WHERE empresa_id = e AND (is_demo OR veiculo_id = ANY(vei));
  UPDATE public.apolices SET apolice_anterior_id = NULL WHERE id = ANY(apo);
  DELETE FROM public.apolices WHERE id = ANY(apo);
  DELETE FROM public.veiculos WHERE id = ANY(vei);
  DELETE FROM public.leads WHERE id = ANY(lea);
  DELETE FROM public.clientes WHERE id = ANY(cli);
  -- Produtores de demonstração: só os que não ficaram com repasses reais.
  FOR p IN SELECT id FROM public.produtores WHERE empresa_id = e AND is_demo LOOP
    BEGIN
      DELETE FROM public.produtores WHERE id = p;
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.limpar_dados_demo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_dados_demo() TO authenticated;
