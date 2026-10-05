CREATE TABLE public.demo_quota_counters (
  bucket text PRIMARY KEY,
  used integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.demo_quota_counters FROM anon, authenticated;
GRANT ALL ON public.demo_quota_counters TO service_role;
ALTER TABLE public.demo_quota_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.demo_consume(_bucket text, _limit integer, _window_seconds integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining integer;
BEGIN
  DELETE FROM public.demo_quota_counters WHERE window_start < now() - interval '2 days';
  INSERT INTO public.demo_quota_counters AS c (bucket, used, window_start) VALUES (_bucket, 1, now())
  ON CONFLICT (bucket) DO UPDATE SET
    used = CASE WHEN c.window_start < now() - make_interval(secs => _window_seconds) THEN 1 ELSE c.used + 1 END,
    window_start = CASE WHEN c.window_start < now() - make_interval(secs => _window_seconds) THEN now() ELSE c.window_start END
  RETURNING _limit - used INTO remaining;
  RETURN remaining;
END $$;
REVOKE ALL ON FUNCTION public.demo_consume(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_consume(text, integer, integer) TO service_role;
