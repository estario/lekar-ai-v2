REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_clinical_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_clinical_request() TO authenticated, service_role;
