REVOKE ALL ON public.report_section_audit FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.report_section_audit FROM authenticated;
REVOKE ALL ON SEQUENCE public.report_section_audit_id_seq FROM anon, authenticated;
