-- Exclusão da própria conta pelo app (exigência da Google Play e da App Store).
-- Regras:
--  * único usuário da corretora: apaga a conta e todos os dados da corretora;
--  * há outros usuários: apaga só a conta (os registros ficam com a corretora);
--  * único administrador com outros usuários ativos: precisa promover outro antes.
-- Os arquivos de documentos são removidos pelo app antes de chamar a função.

CREATE OR REPLACE FUNCTION public.excluir_minha_conta()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _empresa uuid;
  _outros int;
  _admins int;
  _t text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Entre novamente.';
  END IF;
  SELECT empresa_id INTO _empresa FROM public.profiles WHERE id = _uid;

  IF _empresa IS NOT NULL THEN
    SELECT count(*) INTO _outros FROM public.profiles WHERE empresa_id = _empresa AND id <> _uid;
    IF _outros > 0 AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin') THEN
      SELECT count(*) INTO _admins
        FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
       WHERE r.role = 'admin' AND p.empresa_id = _empresa AND p.id <> _uid AND p.ativo;
      IF _admins = 0 THEN
        RAISE EXCEPTION 'Você é o único administrador. Torne outro usuário administrador antes de excluir sua conta.';
      END IF;
    END IF;

    IF _outros = 0 THEN
      -- Apaga os dados da corretora; repete para respeitar a ordem das chaves estrangeiras.
      FOR i IN 1..6 LOOP
        FOR _t IN
          SELECT c.table_name FROM information_schema.columns c
            JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
           WHERE c.table_schema = 'public' AND c.column_name = 'empresa_id'
             AND t.table_type = 'BASE TABLE' AND c.table_name NOT IN ('profiles')
        LOOP
          BEGIN
            EXECUTE format('DELETE FROM public.%I WHERE empresa_id = $1', _t) USING _empresa;
          EXCEPTION WHEN foreign_key_violation THEN
            NULL;
          END;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
  IF _empresa IS NOT NULL AND _outros = 0 THEN
    DELETE FROM public.empresas WHERE id = _empresa;
  END IF;
  DELETE FROM auth.users WHERE id = _uid;
  RETURN CASE WHEN _outros = 0 THEN 'conta_e_corretora' ELSE 'conta' END;
END $$;

REVOKE ALL ON FUNCTION public.excluir_minha_conta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_minha_conta() TO authenticated;
