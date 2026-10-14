-- =====================================================================
-- Comissão sobre o prêmio líquido
-- A comissão do corretor é calculada sobre o prêmio líquido: sem IOF, sem
-- adicional de fracionamento e sem custo de apólice.
--   prêmio total = líquido + adicional de fracionamento + custo de apólice + IOF
--   IOF = alíquota do ramo × (líquido + adicional + custo)
-- Aditiva e idempotente.
-- =====================================================================

ALTER TABLE public.apolices ADD COLUMN IF NOT EXISTS premio_liquido numeric(12,2);
ALTER TABLE public.apolices ADD COLUMN IF NOT EXISTS adicional_fracionamento numeric(12,2);
ALTER TABLE public.apolices ADD COLUMN IF NOT EXISTS custo_apolice numeric(12,2);
ALTER TABLE public.apolices ADD COLUMN IF NOT EXISTS iof numeric(12,2);

-- Alíquota de IOF (%) por ramo: seguros de pessoas 0,38%; saúde 2,38%;
-- previdência e capitalização 0%; demais (auto, residencial, empresarial...) 7,38%.
CREATE OR REPLACE FUNCTION public.aliquota_iof(_ramo text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _ramo IN ('Vida', 'Funeral') THEN 0.38
    WHEN _ramo = 'Saúde' THEN 2.38
    WHEN _ramo IN ('Previdência', 'Capitalização') THEN 0
    ELSE 7.38
  END
$$;
GRANT EXECUTE ON FUNCTION public.aliquota_iof(text) TO authenticated;

-- Base de cálculo da comissão: o prêmio líquido informado ou, se faltar,
-- o total sem IOF, adicional e custo de apólice.
CREATE OR REPLACE FUNCTION public.base_comissao(a public.apolices) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0, CASE
    WHEN a.premio_liquido IS NOT NULL THEN a.premio_liquido
    WHEN a.iof IS NOT NULL THEN COALESCE(a.premio, 0) - a.iof - COALESCE(a.adicional_fracionamento, 0) - COALESCE(a.custo_apolice, 0)
    -- total = (líquido + adicional + custo) × (1 + alíquota)
    ELSE round(COALESCE(a.premio, 0) / (1 + public.aliquota_iof(a.ramo) / 100)
               - COALESCE(a.adicional_fracionamento, 0) - COALESCE(a.custo_apolice, 0), 2)
  END)
$$;
GRANT EXECUTE ON FUNCTION public.base_comissao(public.apolices) TO authenticated;

CREATE OR REPLACE FUNCTION public.comissao_total(a public.apolices) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(a.comissao_valor, round(public.base_comissao(a) * COALESCE(a.comissao_percentual, 0) / 100, 2))
$$;
GRANT EXECUTE ON FUNCTION public.comissao_total(public.apolices) TO authenticated;

-- Parcelas: o cliente paga o prêmio total; a comissão sai do prêmio líquido.
CREATE OR REPLACE FUNCTION public.gerar_parcelas(_apolice_id uuid, _qtd integer DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.apolices%ROWTYPE; n integer; i integer; v numeric; c numeric; ci numeric; r record; tem_rateio boolean; prev date;
BEGIN
  SELECT * INTO a FROM public.apolices WHERE id = _apolice_id AND empresa_id = app_private.my_empresa_id();
  IF a.id IS NULL THEN RAISE EXCEPTION 'Apólice não encontrada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.parcelas WHERE apolice_id = a.id) THEN RAISE EXCEPTION 'Esta apólice já possui parcelas.'; END IF;
  n := COALESCE(_qtd, a.parcelas_qtd, 1);
  IF n < 1 OR n > 24 THEN RAISE EXCEPTION 'Quantidade de parcelas inválida.'; END IF;
  c := public.comissao_total(a);
  tem_rateio := EXISTS (SELECT 1 FROM public.apolice_rateio WHERE apolice_id = a.id);
  FOR i IN 1..n LOOP
    v := CASE WHEN i = n THEN a.premio - trunc(a.premio / n, 2) * (n - 1) ELSE trunc(a.premio / n, 2) END;
    INSERT INTO public.parcelas(empresa_id, apolice_id, numero, vencimento, valor, is_demo)
    VALUES (a.empresa_id, a.id, i, (a.inicio + make_interval(months => i - 1))::date, v, a.is_demo);
    IF c > 0 THEN
      ci := CASE WHEN i = n THEN c - trunc(c / n, 2) * (n - 1) ELSE trunc(c / n, 2) END;
      prev := (a.inicio + make_interval(months => i - 1) + interval '30 days')::date;
      IF tem_rateio THEN
        FOR r IN SELECT ar.produtor_id, ar.percentual, p.usuario_id FROM public.apolice_rateio ar JOIN public.produtores p ON p.id = ar.produtor_id WHERE ar.apolice_id = a.id LOOP
          INSERT INTO public.comissoes(empresa_id, apolice_id, parcela, percentual, valor, data_prevista, responsavel_id, produtor_id, observacoes, is_demo)
          VALUES (a.empresa_id, a.id, i, a.comissao_percentual, round(ci * r.percentual / 100, 2), prev,
                  COALESCE(r.usuario_id, a.responsavel_id, auth.uid()), r.produtor_id, 'Rateio ' || trim(to_char(r.percentual, 'FM990.##')) || '%', a.is_demo);
        END LOOP;
      ELSE
        INSERT INTO public.comissoes(empresa_id, apolice_id, parcela, percentual, valor, data_prevista, responsavel_id, produtor_id, is_demo)
        VALUES (a.empresa_id, a.id, i, a.comissao_percentual, ci, prev, COALESCE(a.responsavel_id, auth.uid()), a.produtor_id, a.is_demo);
      END IF;
    END IF;
  END LOOP;
  UPDATE public.apolices SET parcelas_qtd = n WHERE id = a.id;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.gerar_parcelas(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_parcelas(uuid, integer) TO authenticated;

-- Recalcula as comissões PREVISTAS das parcelas (não mexe nas recebidas, canceladas,
-- conciliadas, repassadas, de endosso nem nas importadas do Mais Corret). _apolice NULL = todas da corretora.
-- Devolve quantas comissões mudaram de valor.
CREATE OR REPLACE FUNCTION public.recalcular_comissoes(_apolice uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.apolices%ROWTYPE; n integer; c numeric; ci numeric; k record; novo numeric; pct numeric; total integer := 0; tem_rateio boolean;
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas o administrador pode recalcular comissões.'; END IF;
  FOR a IN SELECT * FROM public.apolices
            WHERE empresa_id = app_private.my_empresa_id() AND (_apolice IS NULL OR id = _apolice)
              AND EXISTS (SELECT 1 FROM public.comissoes c WHERE c.apolice_id = apolices.id AND c.status = 'Prevista' AND c.endosso_id IS NULL AND c.parcela IS NOT NULL)
  LOOP
    c := public.comissao_total(a);
    n := GREATEST(COALESCE(a.parcelas_qtd, 0), COALESCE((SELECT max(parcela) FROM public.comissoes WHERE apolice_id = a.id AND endosso_id IS NULL), 1));
    tem_rateio := EXISTS (SELECT 1 FROM public.apolice_rateio WHERE apolice_id = a.id);
    FOR k IN SELECT * FROM public.comissoes
              WHERE apolice_id = a.id AND status = 'Prevista' AND endosso_id IS NULL AND parcela IS NOT NULL
                AND conciliacao_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.repasse_itens ri WHERE ri.comissao_id = comissoes.id)
                -- Importadas do sistema anterior: mantém os valores que vieram de lá.
                AND COALESCE(observacoes, '') NOT LIKE 'Importada do Mais Corret%' 
    LOOP
      ci := CASE WHEN k.parcela = n THEN c - trunc(c / n, 2) * (n - 1) ELSE trunc(c / n, 2) END;
      IF tem_rateio THEN
        SELECT percentual INTO pct FROM public.apolice_rateio WHERE apolice_id = a.id AND produtor_id = k.produtor_id;
        IF pct IS NULL THEN CONTINUE; END IF;
        novo := round(ci * pct / 100, 2);
      ELSE
        novo := ci;
      END IF;
      IF novo IS DISTINCT FROM k.valor THEN
        UPDATE public.comissoes SET valor = novo, percentual = a.comissao_percentual WHERE id = k.id;
        total := total + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.recalcular_comissoes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes(uuid) TO authenticated;
