alter table public.profiles add column if not exists password_changed_at timestamptz;

create or replace function private.can_read_acta(p_acta_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_mesa_id uuid;
begin
  select mesa_id into v_mesa_id from public.actas where id = p_acta_id;
  if not found then
    return false;
  end if;
  return private.can_access_mesa(v_mesa_id);
end;
$$;

create or replace function private.can_write_mesa(p_mesa_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles;
  v_recinto_id uuid;
begin
  select * into v_profile from private.current_profile();
  if not found or not v_profile.active then
    return false;
  end if;

  if v_profile.role = 'veedor' then
    return exists (
      select 1
      from public.assignments a
      where a.mesa_id = p_mesa_id
        and a.veedor_id = v_profile.id
        and a.active
    );
  end if;

  if v_profile.role <> 'coordinador_recinto' then
    return false;
  end if;

  select recinto_id into v_recinto_id from public.mesas where id = p_mesa_id;
  if not found then
    return false;
  end if;
  return v_profile.recinto_id = v_recinto_id;
end;
$$;

grant execute on function private.can_read_acta(uuid), private.can_write_mesa(uuid) to authenticated;
revoke all on function private.can_read_acta(uuid), private.can_write_mesa(uuid) from public, anon;

create or replace function private.completar_cambio_clave()
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTENTICACION_REQUERIDA';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and password_changed_at is not null
  ) then
    raise exception 'CLAVE_NO_ACTUALIZADA';
  end if;

  update public.profiles
  set must_change_password = false, password_changed_at = null, updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.sync_profile_password_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and auth.uid() = new.id then
    update public.profiles
    set password_changed_at = now(), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_password_changed() from public, anon, authenticated;
grant execute on function public.sync_profile_password_changed() to postgres, service_role;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
after update of encrypted_password on auth.users
for each row execute function public.sync_profile_password_changed();

create or replace function public.registrar_acta(
  p_operacion_cliente_id uuid,
  p_mesa_id uuid,
  p_dignidad public.dignidad,
  p_version_esperada integer,
  p_total_sufragantes integer,
  p_votos_validos integer,
  p_votos_blancos integer,
  p_votos_nulos integer,
  p_gps_lat double precision,
  p_gps_lng double precision,
  p_gps_precision double precision,
  p_foto_path text,
  p_observaciones text,
  p_votos jsonb
)
returns public.actas
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_acta public.actas;
  v_votos_candidatos integer;
begin
  if not private.can_write_mesa(p_mesa_id) then
    raise exception 'SIN_PERMISO_PARA_ESCRIBIR_ACTA';
  end if;

  select * into v_acta from public.actas where operacion_cliente_id = p_operacion_cliente_id;
  if found then
    if v_acta.mesa_id <> p_mesa_id or v_acta.dignidad <> p_dignidad then
      raise exception 'IDEMPOTENCIA_CONFLICTIVA';
    end if;
    if v_acta.total_sufragantes <> p_total_sufragantes
      or v_acta.votos_validos <> p_votos_validos
      or v_acta.votos_blancos <> p_votos_blancos
      or v_acta.votos_nulos <> p_votos_nulos
      or v_acta.observaciones is distinct from p_observaciones then
      raise exception 'IDEMPOTENCIA_CONFLICTIVA';
    end if;
    return v_acta;
  end if;

  if least(p_total_sufragantes, p_votos_validos, p_votos_blancos, p_votos_nulos) < 0 then
    raise exception 'VALORES_NEGATIVOS_NO_PERMITIDOS';
  end if;

  if p_votos_validos + p_votos_blancos + p_votos_nulos <> p_total_sufragantes then
    raise exception 'CUADRE_MATEMATICO_INVALIDO';
  end if;

  select coalesce(sum((p_votos ->> c.id::text)::integer), 0)
  into v_votos_candidatos
  from public.candidates c
  where c.dignidad = p_dignidad and c.active;

  if v_votos_candidatos <> p_votos_validos then
    raise exception 'SUMA_DE_LISTAS_NO_COINCIDE_CON_VOTOS_VALIDOS';
  end if;

  select * into v_acta from public.actas where mesa_id = p_mesa_id and dignidad = p_dignidad;

  if found and v_acta.version <> p_version_esperada then
    raise exception 'CONFLICTO_EDICION_OFFLINE' using detail = 'La versión remota difiere de la versión local.';
  end if;

  if found then
    begin
      update public.actas
      set
        version = p_version_esperada + 1,
        estado = 'guardado',
        operacion_cliente_id = p_operacion_cliente_id,
        corregido_por = auth.uid(),
        gps_lat = p_gps_lat,
        gps_lng = p_gps_lng,
        gps_precision = p_gps_precision,
        foto_path = p_foto_path,
        total_sufragantes = p_total_sufragantes,
        votos_validos = p_votos_validos,
        votos_blancos = p_votos_blancos,
        votos_nulos = p_votos_nulos,
        observaciones = p_observaciones
      where id = v_acta.id
      returning * into v_acta;
    exception when unique_violation then
      select * into v_acta from public.actas where operacion_cliente_id = p_operacion_cliente_id;
      if not found then
        raise;
      end if;
      if v_acta.mesa_id <> p_mesa_id or v_acta.dignidad <> p_dignidad then
        raise exception 'IDEMPOTENCIA_CONFLICTIVA';
      end if;
    end;
  else
    begin
      insert into public.actas (
        mesa_id,
        dignidad,
        version,
        estado,
        registrado_por,
        gps_lat,
        gps_lng,
        gps_precision,
        foto_path,
        total_sufragantes,
        votos_validos,
        votos_blancos,
        votos_nulos,
        observaciones,
        operacion_cliente_id
      )
      values (
        p_mesa_id,
        p_dignidad,
        p_version_esperada + 1,
        'guardado',
        auth.uid(),
        p_gps_lat,
        p_gps_lng,
        p_gps_precision,
        p_foto_path,
        p_total_sufragantes,
        p_votos_validos,
        p_votos_blancos,
        p_votos_nulos,
        p_observaciones,
        p_operacion_cliente_id
      )
      returning * into v_acta;
    exception when unique_violation then
      select * into v_acta from public.actas where operacion_cliente_id = p_operacion_cliente_id;
      if not found then
        raise;
      end if;
      if v_acta.mesa_id <> p_mesa_id or v_acta.dignidad <> p_dignidad then
        raise exception 'IDEMPOTENCIA_CONFLICTIVA';
      end if;
    end;
  end if;

  delete from public.vote_details where acta_id = v_acta.id;

  insert into public.vote_details (acta_id, organization_id, candidate_id, votos)
  select v_acta.id, c.organization_id, c.id, coalesce((p_votos ->> c.id::text)::integer, 0)
  from public.candidates c
  where c.dignidad = p_dignidad and c.active;

  return v_acta;
end;
$$;

create or replace function public.asignar_veedor(
  p_mesa_ids uuid[],
  p_veedor_id uuid,
  p_reason text
)
returns setof public.assignments
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles;
  v_veedor public.profiles;
  v_recinto_id uuid;
  v_mesa_id uuid;
  v_assignment public.assignments;
begin
  select * into v_profile from private.current_profile();
  if not found or v_profile.role <> 'coordinador_recinto' then
    raise exception 'SIN_PERMISO_PARA_ASIGNAR';
  end if;

  if coalesce(array_length(p_mesa_ids, 1), 0) = 0 then
    raise exception 'MESAS_REQUERIDAS';
  end if;

  select * into v_veedor from public.profiles where id = p_veedor_id;
  if not found or v_veedor.role <> 'veedor'::public.user_role or not v_veedor.active then
    raise exception 'VEEDOR_INVALIDO';
  end if;

  select distinct m.recinto_id into v_recinto_id
  from public.mesas m
  where m.id = any(p_mesa_ids);
  if not found or v_recinto_id is null or v_veedor.recinto_id is distinct from v_recinto_id then
    raise exception 'VEEDOR_FUERA_DEL_RECINTO';
  end if;

  foreach v_mesa_id in array p_mesa_ids loop
    if not private.can_edit_mesa(v_mesa_id) then
      raise exception 'SIN_PERMISO_PARA_LA_MESA';
    end if;
    if exists (select 1 from public.assignments a where a.mesa_id = v_mesa_id and a.active) then
      raise exception 'MESA_YA_ASIGNADA';
    end if;

    begin
      insert into public.assignments (mesa_id, veedor_id, assigned_by, reason, active)
      values (v_mesa_id, p_veedor_id, auth.uid(), p_reason, true)
      returning * into v_assignment;
      return next v_assignment;
    exception when unique_violation then
      raise exception 'MESA_YA_ASIGNADA';
    end;
  end loop;
end;
$$;

create or replace function public.reemplazar_veedor(
  p_mesa_ids uuid[],
  p_previous_veedor_id uuid,
  p_next_veedor_id uuid,
  p_reason text
)
returns setof public.assignments
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles;
  v_veedor public.profiles;
  v_recinto_id uuid;
  v_mesa_id uuid;
  v_previous public.assignments;
  v_assignment public.assignments;
begin
  select * into v_profile from private.current_profile();
  if not found or v_profile.role <> 'coordinador_recinto' then
    raise exception 'SIN_PERMISO_PARA_ASIGNAR';
  end if;
  if coalesce(array_length(p_mesa_ids, 1), 0) = 0 then
    raise exception 'MESAS_REQUERIDAS';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  if p_previous_veedor_id = p_next_veedor_id then
    raise exception 'VEEDOR_IGUAL';
  end if;

  select * into v_veedor from public.profiles where id = p_next_veedor_id;
  if not found or v_veedor.role <> 'veedor'::public.user_role or not v_veedor.active then
    raise exception 'VEEDOR_INVALIDO';
  end if;

  select distinct m.recinto_id into v_recinto_id
  from public.mesas m
  where m.id = any(p_mesa_ids);
  if not found or v_recinto_id is null or v_veedor.recinto_id is distinct from v_recinto_id then
    raise exception 'VEEDOR_FUERA_DEL_RECINTO';
  end if;

  foreach v_mesa_id in array p_mesa_ids loop
    if not private.can_edit_mesa(v_mesa_id) then
      raise exception 'SIN_PERMISO_PARA_LA_MESA';
    end if;

    select * into v_previous
    from public.assignments a
    where a.mesa_id = v_mesa_id
      and a.veedor_id = p_previous_veedor_id
      and a.active
    limit 1;
    if not found then
      raise exception 'ASIGNACION_PREVIA_NO_ENCONTRADA';
    end if;

    update public.assignments
    set active = false, unassigned_at = now()
    where id = v_previous.id;

    begin
      insert into public.assignments (
        mesa_id, veedor_id, assigned_by, replaces_assignment_id, reason, active
      )
      values (
        v_mesa_id, p_next_veedor_id, auth.uid(), v_previous.id, p_reason, true
      )
      returning * into v_assignment;
      return next v_assignment;
    exception when unique_violation then
      raise exception 'MESA_YA_ASIGNADA';
    end;
  end loop;
end;
$$;

drop policy if exists actas_insert on public.actas;
drop policy if exists actas_insert_deny on public.actas;
create policy actas_insert_deny on public.actas for insert to authenticated with check (false);

drop policy if exists actas_update on public.actas;
drop policy if exists actas_update_deny on public.actas;
create policy actas_update_deny on public.actas for update to authenticated using (false) with check (false);

drop policy if exists actas_delete on public.actas;
drop policy if exists actas_delete_deny on public.actas;
create policy actas_delete_deny on public.actas for delete to authenticated using (false);

drop policy if exists vote_details_select on public.vote_details;
create policy vote_details_select on public.vote_details for select to authenticated using (
  private.can_read_acta(acta_id)
);

drop policy if exists vote_details_insert on public.vote_details;
drop policy if exists vote_details_insert_deny on public.vote_details;
create policy vote_details_insert_deny on public.vote_details for insert to authenticated with check (false);

drop policy if exists vote_details_update on public.vote_details;
drop policy if exists vote_details_update_deny on public.vote_details;
create policy vote_details_update_deny on public.vote_details for update to authenticated using (false) with check (false);

drop policy if exists vote_details_delete on public.vote_details;
drop policy if exists vote_details_delete_deny on public.vote_details;
create policy vote_details_delete_deny on public.vote_details for delete to authenticated using (false);

drop policy if exists conflicts_select on public.acta_edit_conflicts;
create policy conflicts_select on public.acta_edit_conflicts for select to authenticated using (
  (acta_id is not null and private.can_read_acta(acta_id))
  or private.can_edit_mesa(mesa_id)
  or (acta_id is null and detected_by = (select auth.uid()))
);

create or replace function private.can_access_acta_photo(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
set row_security = off
as $$
  select (storage.foldername(p_object_name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.actas a
        where a.foto_path = p_object_name and private.can_read_acta(a.id)
      );
$$;

grant execute on function private.can_read_acta(uuid), private.can_write_mesa(uuid), private.can_access_acta_photo(text) to authenticated;
revoke all on function private.can_read_acta(uuid), private.can_write_mesa(uuid), private.can_access_acta_photo(text) from public, anon;

grant execute on function public.registrar_acta(uuid, uuid, public.dignidad, integer, integer, integer, integer, integer, double precision, double precision, double precision, text, text, jsonb) to authenticated;
grant execute on function public.asignar_veedor(uuid[], uuid, text), public.reemplazar_veedor(uuid[], uuid, uuid, text) to authenticated;
revoke all on function public.registrar_acta(uuid, uuid, public.dignidad, integer, integer, integer, integer, integer, double precision, double precision, double precision, text, text, jsonb), public.asignar_veedor(uuid[], uuid, text), public.reemplazar_veedor(uuid[], uuid, uuid, text) from public, anon;
