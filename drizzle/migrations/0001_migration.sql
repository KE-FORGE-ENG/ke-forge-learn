GRANT SELECT ON public.community_publications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_publications TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_fork(uuid) TO authenticated;