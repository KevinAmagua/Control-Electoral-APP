drop policy if exists recintos_select on public.recintos;
create policy recintos_select on public.recintos for select to authenticated using (
  exists (
    select 1 from private.current_profile() cp
    where cp.active and (
      (cp.role = 'coordinador_provincial' and recintos.province = cp.province and recintos.canton = cp.canton)
      or (cp.role = 'coordinador_recinto' and recintos.id = cp.recinto_id)
      or (cp.role = 'veedor' and exists (
        select 1 from public.mesas m
        join public.assignments a on a.mesa_id = m.id
        where m.recinto_id = recintos.id and a.veedor_id = cp.id and a.active
      ))
    )
  )
);
