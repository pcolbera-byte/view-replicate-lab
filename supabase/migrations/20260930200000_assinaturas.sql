-- Assinatura da corretora (cobrança no site, pelo Mercado Pago).
-- Cada corretora tem uma linha. Só o servidor (webhook / funções do app com a chave de serviço)
-- altera a assinatura; os usuários apenas leem a da própria corretora.

CREATE TABLE IF NOT EXISTS public.assinaturas (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'teste'
    CHECK (status IN ('teste', 'pendente', 'ativa', 'atrasada', 'cancelada', 'isenta')),
  teste_ate date NOT NULL DEFAULT (current_date + 14),
  pago_ate date,
  valor numeric(12,2),
  mp_preapproval_id text,
  mp_status text,
  proxima_cobranca date,
  ultimo_pagamento_em timestamptz,
  ultimo_pagamento_status text,
  cancelada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_mp ON public.assinaturas (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assinaturas_select ON public.assinaturas;
CREATE POLICY assinaturas_select ON public.assinaturas FOR SELECT TO authenticated
  USING (empresa_id = app_private.my_empresa_id());
REVOKE INSERT, UPDATE, DELETE ON public.assinaturas FROM anon, authenticated;
GRANT SELECT ON public.assinaturas TO authenticated;

DROP TRIGGER IF EXISTS touch_updated_at ON public.assinaturas;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Corretoras que já existem quando a cobrança é ligada (a sua) ficam isentas.
INSERT INTO public.assinaturas (empresa_id, status)
SELECT id, 'isenta' FROM public.empresas
ON CONFLICT (empresa_id) DO NOTHING;

-- Toda corretora nova começa no teste grátis de 14 dias.
CREATE OR REPLACE FUNCTION app_private.criar_assinatura() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.assinaturas (empresa_id, status, teste_ate)
  VALUES (NEW.id, 'teste', current_date + 14)
  ON CONFLICT (empresa_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS criar_assinatura ON public.empresas;
CREATE TRIGGER criar_assinatura AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION app_private.criar_assinatura();
