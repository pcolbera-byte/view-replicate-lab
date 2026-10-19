-- =====================================================================
-- Imposto retido sobre a comissão (ISS/IR), por corretora.
-- A seguradora paga a comissão já descontada do imposto; a comissão prevista
-- passa a ser: prêmio líquido × % × (1 − imposto). Padrão: 2%.
-- Aditiva e idempotente. Depende de 20261013230000_premio_liquido.sql.
-- =====================================================================

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS imposto_comissao numeric(5,2) NOT NULL DEFAULT 2;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_imposto_comissao_faixa') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT empresas_imposto_comissao_faixa CHECK (imposto_comissao >= 0 AND imposto_comissao < 100);
  END IF;
END $$;

-- O administrador altera em Configurações (permissão por coluna, como as demais).
GRANT UPDATE (imposto_comissao) ON public.empresas TO authenticated;

-- Comissão total da apólice: valor fixo informado ou % sobre o líquido, menos o imposto.
CREATE OR REPLACE FUNCTION public.comissao_total(a public.apolices) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(a.comissao_valor,
    round(public.base_comissao(a) * COALESCE(a.comissao_percentual, 0) / 100
          * (1 - COALESCE((SELECT e.imposto_comissao FROM public.empresas e WHERE e.id = a.empresa_id), 0) / 100), 2))
$$;
GRANT EXECUTE ON FUNCTION public.comissao_total(public.apolices) TO authenticated;
