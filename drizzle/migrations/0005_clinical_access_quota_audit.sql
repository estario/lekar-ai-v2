-- 1) Current-user-only role helpers; has_role no longer answers for other users (service role unaffected).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (_user_id = auth.uid() OR auth.uid() IS NULL)
     AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS SETOF public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.is_clinical_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('clinician','admin'))
$$;
REVOKE ALL ON FUNCTION public.current_user_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_clinical_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clinical_user() TO authenticated, service_role;

-- 2) Daily per-clinician provider budgets (service-internal table; only reachable through the definer function).
CREATE TABLE public.clinical_daily_usage (
  user_id uuid NOT NULL,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('report','assistant','recording')),
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);
REVOKE ALL ON public.clinical_daily_usage FROM anon, authenticated;
GRANT ALL ON public.clinical_daily_usage TO service_role;
ALTER TABLE public.clinical_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reserve_clinical_budget(_kind text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); lim integer; rem integer; d date := (now() AT TIME ZONE 'Europe/Sofia')::date;
BEGIN
  IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = uid AND role IN ('clinician','admin')) THEN
    RAISE EXCEPTION 'not_approved';
  END IF;
  lim := CASE _kind WHEN 'report' THEN 40 WHEN 'assistant' THEN 120 WHEN 'recording' THEN 20 ELSE NULL END;
  IF lim IS NULL THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  INSERT INTO public.clinical_daily_usage AS u (user_id, day, kind, used) VALUES (uid, d, _kind, 1)
  ON CONFLICT (user_id, day, kind) DO UPDATE SET used = u.used + 1 WHERE u.used < lim
  RETURNING lim - u.used INTO rem;
  IF rem IS NULL THEN RETURN -1; END IF;
  DELETE FROM public.clinical_daily_usage WHERE user_id = uid AND day < d - 7;
  RETURN rem;
END $$;
REVOKE ALL ON FUNCTION public.reserve_clinical_budget(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_clinical_budget(text) TO authenticated, service_role;

-- 3) Atomic all-or-nothing demo quota reservation across buckets (deterministic lock order).
CREATE OR REPLACE FUNCTION public.demo_reserve(_buckets text[], _limits integer[], _windows integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := coalesce(array_length(_buckets,1),0); i integer; b text; r record; cur integer; rem integer[];
BEGIN
  IF n = 0 OR n > 8 OR n <> coalesce(array_length(_limits,1),0) OR n <> coalesce(array_length(_windows,1),0)
     OR (SELECT count(DISTINCT x) FROM unnest(_buckets) x) <> n THEN
    RAISE EXCEPTION 'invalid_buckets';
  END IF;
  DELETE FROM public.demo_quota_counters WHERE bucket IN (
    SELECT bucket FROM public.demo_quota_counters WHERE window_start < now() - interval '2 days' AND bucket <> ALL(_buckets)
    FOR UPDATE SKIP LOCKED);
  FOR b IN SELECT x FROM unnest(_buckets) x ORDER BY x LOOP
    INSERT INTO public.demo_quota_counters(bucket, used, window_start) VALUES (b, 0, now()) ON CONFLICT (bucket) DO NOTHING;
    PERFORM 1 FROM public.demo_quota_counters WHERE bucket = b FOR UPDATE;
  END LOOP;
  rem := array_fill(0, ARRAY[n]);
  FOR i IN 1..n LOOP
    SELECT used, window_start INTO r FROM public.demo_quota_counters WHERE bucket = _buckets[i];
    cur := CASE WHEN r.window_start < now() - make_interval(secs => _windows[i]) THEN 0 ELSE r.used END;
    IF cur + 1 > _limits[i] THEN RETURN jsonb_build_object('ok', false, 'failed', i - 1); END IF;
    rem[i] := _limits[i] - cur - 1;
  END LOOP;
  FOR i IN 1..n LOOP
    UPDATE public.demo_quota_counters SET
      used = CASE WHEN window_start < now() - make_interval(secs => _windows[i]) THEN 1 ELSE used + 1 END,
      window_start = CASE WHEN window_start < now() - make_interval(secs => _windows[i]) THEN now() ELSE window_start END
    WHERE bucket = _buckets[i];
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'remaining', to_jsonb(rem));
END $$;
REVOKE ALL ON FUNCTION public.demo_reserve(text[], integer[], integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_reserve(text[], integer[], integer[]) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_consume(_bucket text, _limit integer, _window_seconds integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining integer;
BEGIN
  DELETE FROM public.demo_quota_counters WHERE bucket IN (
    SELECT bucket FROM public.demo_quota_counters WHERE window_start < now() - interval '2 days' AND bucket <> _bucket
    FOR UPDATE SKIP LOCKED);
  INSERT INTO public.demo_quota_counters AS c (bucket, used, window_start) VALUES (_bucket, 1, now())
  ON CONFLICT (bucket) DO UPDATE SET
    used = CASE WHEN c.window_start < now() - make_interval(secs => _window_seconds) THEN 1 ELSE c.used + 1 END,
    window_start = CASE WHEN c.window_start < now() - make_interval(secs => _window_seconds) THEN now() ELSE c.window_start END
  RETURNING _limit - used INTO remaining;
  RETURN remaining;
END $$;
REVOKE ALL ON FUNCTION public.demo_consume(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_consume(text, integer, integer) TO service_role;

-- 4) Persisted client order for transcript lines.
ALTER TABLE public.transcript_segments ADD COLUMN client_seq bigint;

-- 5) Server-set consent and verification timestamps.
CREATE OR REPLACE FUNCTION public.consultations_server_stamps()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.consent_at IS NOT NULL THEN NEW.consent_at := now(); END IF;
    NEW.created_at := now(); NEW.updated_at := now();
  ELSE
    NEW.consent_at := OLD.consent_at;
    NEW.consent_notice_version := OLD.consent_notice_version;
    NEW.clinician_id := OLD.clinician_id;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consultations_server_stamps BEFORE INSERT OR UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.consultations_server_stamps();

CREATE OR REPLACE FUNCTION public.report_sections_server_stamps()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.verified_at IS NOT NULL THEN NEW.verified_at := now(); END IF;
  ELSE
    NEW.clinician_id := OLD.clinician_id;
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      IF NEW.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN NEW.verified_at := now();
      ELSE NEW.verified_at := NULL; END IF;
    ELSIF NEW.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      NEW.verified_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER report_sections_server_stamps BEFORE INSERT OR UPDATE ON public.report_sections
FOR EACH ROW EXECUTE FUNCTION public.report_sections_server_stamps();

-- 6) Append-only audit of report section changes (hash + length only, no content copy).
CREATE TABLE public.report_section_audit (
  id bigserial PRIMARY KEY,
  consultation_id uuid NOT NULL,
  clinician_id uuid NOT NULL,
  section text NOT NULL,
  action text NOT NULL,
  content_sha256 text NOT NULL,
  content_length integer NOT NULL,
  verified boolean NOT NULL,
  actor uuid,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_section_audit TO authenticated;
GRANT ALL ON public.report_section_audit TO service_role;
ALTER TABLE public.report_section_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.report_section_audit FOR SELECT TO authenticated USING (clinician_id = auth.uid());

CREATE OR REPLACE FUNCTION public.report_sections_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.content IS NOT DISTINCT FROM OLD.content AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at THEN
    RETURN NEW;
  END IF;
  act := CASE
    WHEN TG_OP = 'INSERT' THEN 'created'
    WHEN NEW.verified_at IS NOT NULL AND OLD.verified_at IS DISTINCT FROM NEW.verified_at THEN 'verified'
    WHEN NEW.content IS DISTINCT FROM OLD.content THEN 'edited'
    ELSE 'unverified' END;
  INSERT INTO public.report_section_audit(consultation_id, clinician_id, section, action, content_sha256, content_length, verified, actor)
  VALUES (NEW.consultation_id, NEW.clinician_id, NEW.section, act, encode(sha256(convert_to(NEW.content, 'UTF8')), 'hex'), length(NEW.content), NEW.verified_at IS NOT NULL, auth.uid());
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.report_sections_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER report_sections_audit AFTER INSERT OR UPDATE ON public.report_sections
FOR EACH ROW EXECUTE FUNCTION public.report_sections_audit();
