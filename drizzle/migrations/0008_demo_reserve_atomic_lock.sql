CREATE OR REPLACE FUNCTION public.demo_reserve(_buckets text[], _limits integer[], _windows integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := coalesce(array_length(_buckets,1),0); i integer; b text; r record; cur integer; rem integer[]; locked integer;
BEGIN
  IF n = 0 OR n > 8 OR n <> coalesce(array_length(_limits,1),0) OR n <> coalesce(array_length(_windows,1),0)
     OR (SELECT count(DISTINCT x) FROM unnest(_buckets) x) <> n OR EXISTS (SELECT 1 FROM unnest(_buckets) x WHERE x IS NULL) THEN
    RAISE EXCEPTION 'invalid_buckets';
  END IF;
  -- Atomic upsert acquires the row lock in sorted order; a concurrent cleanup cannot leave the row missing.
  FOR b IN SELECT x FROM unnest(_buckets) x ORDER BY x LOOP
    INSERT INTO public.demo_quota_counters AS c (bucket, used, window_start) VALUES (b, 0, now())
    ON CONFLICT (bucket) DO UPDATE SET bucket = c.bucket;
    GET DIAGNOSTICS locked = ROW_COUNT;
    IF locked <> 1 THEN RAISE EXCEPTION 'quota_row_missing'; END IF;
  END LOOP;
  rem := array_fill(0, ARRAY[n]);
  FOR i IN 1..n LOOP
    SELECT used, window_start INTO r FROM public.demo_quota_counters WHERE bucket = _buckets[i];
    IF NOT FOUND OR r.used IS NULL OR r.window_start IS NULL OR _limits[i] IS NULL OR _windows[i] IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'failed', i - 1);
    END IF;
    cur := CASE WHEN r.window_start < now() - make_interval(secs => _windows[i]) THEN 0 ELSE r.used END;
    IF cur + 1 > _limits[i] THEN RETURN jsonb_build_object('ok', false, 'failed', i - 1); END IF;
    rem[i] := _limits[i] - cur - 1;
  END LOOP;
  FOR i IN 1..n LOOP
    UPDATE public.demo_quota_counters SET
      used = CASE WHEN window_start < now() - make_interval(secs => _windows[i]) THEN 1 ELSE used + 1 END,
      window_start = CASE WHEN window_start < now() - make_interval(secs => _windows[i]) THEN now() ELSE window_start END
    WHERE bucket = _buckets[i];
    GET DIAGNOSTICS locked = ROW_COUNT;
    IF locked <> 1 THEN RAISE EXCEPTION 'quota_row_missing'; END IF;
  END LOOP;
  IF rem IS NULL OR array_position(rem, NULL) IS NOT NULL THEN RAISE EXCEPTION 'quota_remaining_missing'; END IF;
  RETURN jsonb_build_object('ok', true, 'remaining', to_jsonb(rem));
END $$;
REVOKE ALL ON FUNCTION public.demo_reserve(text[], integer[], integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_reserve(text[], integer[], integer[]) TO service_role;
