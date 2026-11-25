revoke all on function public.registrar_acta(uuid, uuid, public.dignidad, integer, integer, integer, integer, integer, double precision, double precision, double precision, text, text, jsonb) from public, anon;

revoke all on function public.asignar_veedor(uuid[], uuid, text) from public, anon;

revoke all on function public.reemplazar_veedor(uuid[], uuid, uuid, text) from public, anon;

grant execute on function public.registrar_acta(uuid, uuid, public.dignidad, integer, integer, integer, integer, integer, double precision, double precision, double precision, text, text, jsonb) to authenticated, service_role;

grant execute on function public.asignar_veedor(uuid[], uuid, text), public.reemplazar_veedor(uuid[], uuid, uuid, text) to authenticated, service_role;
