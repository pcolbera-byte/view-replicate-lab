-- Backup de toda a plataforma (todas as corretoras), só para o dono, pelo Painel do dono.
CREATE OR REPLACE FUNCTION public.dono_backup_plataforma()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _t text;
  _linhas jsonb;
  _saida jsonb := jsonb_build_object('app', 'corretix', 'tipo', 'plataforma', 'gerado_em', now());
  _tabelas jsonb := '{}'::jsonb;
BEGIN
  IF NOT app_private.sou_dono() THEN
    RAISE EXCEPTION 'Acesso restrito ao dono da plataforma.';
  END IF;
  FOR _t IN
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'plataforma_donos'
     ORDER BY table_name
  LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM public.%I x', _t) INTO _linhas;
    _tabelas := _tabelas || jsonb_build_object(_t, _linhas);
  END LOOP;
  RETURN _saida || jsonb_build_object('tabelas', _tabelas);
END $$;
REVOKE ALL ON FUNCTION public.dono_backup_plataforma() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dono_backup_plataforma() TO authenticated;
