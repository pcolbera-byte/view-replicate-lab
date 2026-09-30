-- =====================================================================
-- Produtores (como no Mais Corret) + rateio de comissão por apólice
-- Aditiva e idempotente. Depende de 20260930120000_complementos_gestao.sql.
--   * produtores: a própria corretora e os produtores (pessoas/parceiros),
--     opcionalmente ligados a um usuário do app (usuario_id)
--   * produtor_id em clientes, leads, apólices e comissões
--   * apolice_rateio: divisão da comissão da apólice entre produtores (%)
--   * gerar_parcelas: cria uma comissão por parcela para cada produtor do rateio
--   * produtor com login vê as próprias comissões (além do administrador)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.produtores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  nome_completo text DEFAULT '',
  tipo text NOT NULL DEFAULT 'Produtor' CHECK (tipo IN ('Corretora', 'Produtor')),
  documento text DEFAULT '',
  telefone text DEFAULT '',
  email text DEFAULT '',
  percentual_padrao numeric(5,2) CHECK (percentual_padrao IS NULL OR (percentual_padrao >= 0 AND percentual_padrao <= 100)),
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS produtores_nome_unico ON public.produtores (empresa_id, lower(nome));
CREATE UNIQUE INDEX IF NOT EXISTS produtores_usuario_unico ON public.produtores (usuario_id) WHERE usuario_id IS NOT NULL;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS produtor_id uuid REFERENCES public.produtores(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS produtor_id uuid REFERENCES public.produtores(id) ON DELETE SET NULL;
ALTER TABLE public.apolices ADD COLUMN IF NOT EXISTS produtor_id uuid REFERENCES public.produtores(id) ON DELETE SET NULL;
ALTER TABLE public.comissoes ADD COLUMN IF NOT EXISTS produtor_id uuid REFERENCES public.produtores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clientes_produtor ON public.clientes(empresa_id, produtor_id);
CREATE INDEX IF NOT EXISTS apolices_produtor ON public.apolices(empresa_id, produtor_id);
CREATE INDEX IF NOT EXISTS comissoes_produtor ON public.comissoes(empresa_id, produtor_id);

CREATE TABLE IF NOT EXISTS public.apolice_rateio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  apolice_id uuid NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  produtor_id uuid NOT NULL REFERENCES public.produtores(id) ON DELETE CASCADE,
  percentual numeric(5,2) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (apolice_id, produtor_id)
);
CREATE INDEX IF NOT EXISTS apolice_rateio_apolice ON public.apolice_rateio(apolice_id);

-- ---------- Permissões ---------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apolice_rateio TO authenticated;
GRANT ALL ON public.produtores TO service_role;
GRANT ALL ON public.apolice_rateio TO service_role;
ALTER TABLE public.produtores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apolice_rateio ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS touch_updated_at ON public.produtores;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.produtores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_updated_at ON public.apolice_rateio;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.apolice_rateio FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Produtores: toda a equipe vê; só o administrador cadastra/altera.
DROP POLICY IF EXISTS produtores_select ON public.produtores;
DROP POLICY IF EXISTS produtores_admin ON public.produtores;
CREATE POLICY produtores_select ON public.produtores FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY produtores_admin ON public.produtores FOR ALL TO authenticated
  USING (empresa_id = app_private.my_empresa_id() AND app_private.is_admin())
  WITH CHECK (empresa_id = app_private.my_empresa_id() AND app_private.is_admin()
    AND (usuario_id IS NULL OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = usuario_id AND p.empresa_id = app_private.my_empresa_id())));

-- Rateio: quem opera a apólice define a divisão (mesma regra de edição das apólices).
DROP POLICY IF EXISTS rateio_select ON public.apolice_rateio;
DROP POLICY IF EXISTS rateio_insert ON public.apolice_rateio;
DROP POLICY IF EXISTS rateio_update ON public.apolice_rateio;
DROP POLICY IF EXISTS rateio_delete ON public.apolice_rateio;
CREATE POLICY rateio_select ON public.apolice_rateio FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id());
CREATE POLICY rateio_insert ON public.apolice_rateio FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id())
  AND EXISTS (SELECT 1 FROM public.produtores p WHERE p.id = produtor_id AND p.empresa_id = app_private.my_empresa_id()));
CREATE POLICY rateio_update ON public.apolice_rateio FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolice_id AND a.empresa_id = app_private.my_empresa_id())
  AND EXISTS (SELECT 1 FROM public.produtores p WHERE p.id = produtor_id AND p.empresa_id = app_private.my_empresa_id()));
CREATE POLICY rateio_delete ON public.apolice_rateio FOR DELETE TO authenticated USING (empresa_id = app_private.my_empresa_id());

-- produtor_id sempre da mesma corretora do registro (vale para clientes, leads, apólices e comissões).
CREATE OR REPLACE FUNCTION app_private.checar_produtor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.produtor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.produtores p WHERE p.id = NEW.produtor_id AND p.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Produtor inválido para esta corretora.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.checar_produtor() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','leads','apolices','comissoes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS checar_produtor ON public.%I', t);
    EXECUTE format('CREATE TRIGGER checar_produtor BEFORE INSERT OR UPDATE OF produtor_id ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.checar_produtor()', t);
  END LOOP;
END $$;

-- Comissões: administrador vê todas; o usuário vê as que são dele como responsável
-- ou como produtor vinculado ao seu login.
CREATE OR REPLACE FUNCTION app_private.meus_produtores() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT id FROM public.produtores WHERE usuario_id = auth.uid() AND empresa_id = app_private.my_empresa_id() $$;
REVOKE ALL ON FUNCTION app_private.meus_produtores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.meus_produtores() TO authenticated;
DROP POLICY IF EXISTS comissoes_select ON public.comissoes;
CREATE POLICY comissoes_select ON public.comissoes FOR SELECT TO authenticated USING (empresa_id = app_private.my_empresa_id()
  AND (app_private.is_admin() OR responsavel_id = auth.uid() OR produtor_id IN (SELECT app_private.meus_produtores())));

-- ---------- Parcelas e comissões com rateio --------------------------------
CREATE OR REPLACE FUNCTION public.gerar_parcelas(_apolice_id uuid, _qtd integer DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.apolices%ROWTYPE; n integer; i integer; v numeric; c numeric; ci numeric; r record; tem_rateio boolean; prev date;
BEGIN
  SELECT * INTO a FROM public.apolices WHERE id = _apolice_id AND empresa_id = app_private.my_empresa_id();
  IF a.id IS NULL THEN RAISE EXCEPTION 'Apólice não encontrada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.parcelas WHERE apolice_id = a.id) THEN RAISE EXCEPTION 'Esta apólice já possui parcelas.'; END IF;
  n := COALESCE(_qtd, a.parcelas_qtd, 1);
  IF n < 1 OR n > 24 THEN RAISE EXCEPTION 'Quantidade de parcelas inválida.'; END IF;
  c := COALESCE(a.comissao_valor, round(a.premio * COALESCE(a.comissao_percentual, 0) / 100, 2));
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

-- Dados de demonstração também removem produtores/rateios de demonstração.
CREATE OR REPLACE FUNCTION public.limpar_dados_demo() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e uuid := app_private.my_empresa_id();
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem limpar os dados de demonstração.'; END IF;
  DELETE FROM public.comissoes WHERE empresa_id = e AND is_demo;
  DELETE FROM public.parcelas WHERE empresa_id = e AND is_demo;
  DELETE FROM public.apolice_rateio WHERE empresa_id = e AND is_demo;
  DELETE FROM public.historico_contatos WHERE empresa_id = e AND is_demo;
  DELETE FROM public.tarefas WHERE empresa_id = e AND is_demo;
  DELETE FROM public.sinistros WHERE empresa_id = e AND is_demo;
  DELETE FROM public.condutores WHERE empresa_id = e AND is_demo;
  UPDATE public.apolices SET apolice_anterior_id = NULL WHERE empresa_id = e AND is_demo;
  DELETE FROM public.apolices WHERE empresa_id = e AND is_demo;
  DELETE FROM public.veiculos WHERE empresa_id = e AND is_demo;
  DELETE FROM public.leads WHERE empresa_id = e AND is_demo;
  DELETE FROM public.clientes WHERE empresa_id = e AND is_demo;
  DELETE FROM public.produtores WHERE empresa_id = e AND is_demo;
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'Há registros reais vinculados a dados de demonstração. Desvincule-os antes de limpar.';
END $$;
REVOKE ALL ON FUNCTION public.limpar_dados_demo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_dados_demo() TO authenticated;
