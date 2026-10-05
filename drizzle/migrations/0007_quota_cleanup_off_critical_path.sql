CREATE OR REPLACE FUNCTION public.demo_reserve(_buckets text[], _limits integer[], _windows integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := coalesce(array_length(_buckets,1),0); i integer; b text; r record; cur integer; rem integer[];
BEGIN
  IF n = 0 OR n > 8 OR n <> coalesce(array_length(_limits,1),0) OR n <> coalesce(array_length(_windows,1),0)
     OR (SELECT count(DISTINCT x) FROM unnest(_buckets) x) <> n THEN
    RAISE EXCEPTION 'invalid_buckets';
  END IF;
  -- No cleanup here: the only row locks taken are the requested buckets, in sorted order.
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
  INSERT INTO public.demo_quota_counters AS c (bucket, used, window_start) VALUES (_bucket, 1, now())
  ON CONFLICT (bucket) DO UPDATE SET
    used = CASE WHEN c.window_start < now() - make_interval(secs => _window_seconds) THEN 1 ELSE c.used + 1 END,
    window_start = CASE WHEN c.window_start < now() - make_interval(secs => _window_seconds) THEN now() ELSE c.window_start END
  RETURNING _limit - used INTO remaining;
  RETURN remaining;
END $$;
REVOKE ALL ON FUNCTION public.demo_consume(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_consume(text, integer, integer) TO service_role;

-- Bounded maintenance, called as its own transaction after a reservation (best effort).
CREATE OR REPLACE FUNCTION public.demo_quota_cleanup()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM public.demo_quota_counters WHERE bucket IN (
    SELECT bucket FROM public.demo_quota_counters WHERE window_start < now() - interval '2 days'
    LIMIT 200 FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END $$;
REVOKE ALL ON FUNCTION public.demo_quota_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_quota_cleanup() TO service_role;
