drop policy if exists mesas_update on public.mesas;
create policy mesas_update on public.mesas for update to authenticated using (
  private.can_edit_mesa(mesas.id)
) with check (
  private.can_edit_mesa(mesas.id)
);

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated using (
  (
    assignments.active
    and exists (
      select 1
      from private.current_profile() cp
      where cp.active and cp.role = 'veedor' and cp.id = assignments.veedor_id
    )
  )
  or private.can_edit_mesa(assignments.mesa_id)
);
