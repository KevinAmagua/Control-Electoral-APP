create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('coordinador_provincial', 'coordinador_recinto', 'veedor');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.dignidad as enum ('alcaldia', 'prefectura');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.acta_status as enum ('en_proceso', 'guardado', 'fallado');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.conflict_status as enum ('detectado', 'en_revision', 'resuelto', 'descartado');
exception when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text not null unique,
  list_number integer not null unique check (list_number between 1 and 100),
  primary_color text not null,
  secondary_color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recintos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text not null,
  province text not null default 'Pichincha',
  canton text not null default 'Quito',
  parish text,
  gps_lat double precision not null,
  gps_lng double precision not null,
  radius_meters integer not null default 300 check (radius_meters > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mesas (
  id uuid primary key default gen_random_uuid(),
  recinto_id uuid not null references public.recintos(id) on delete cascade,
  number text not null,
  registered_voters integer not null check (registered_voters >= 0),
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recinto_id, number)
);

create table if not exists public.jrv_members (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  role text not null check (role in ('presidente', 'secretario', 'vocal_1', 'vocal_2', 'suplente')),
  full_name text not null,
  cedula text,
  created_at timestamptz not null default now(),
  unique (mesa_id, role)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  cedula text not null unique check (cedula ~ '^[0-9]{10}$'),
  first_name text not null,
  last_name text not null,
  phone text,
  email text not null unique,
  email_verified boolean not null default false,
  must_change_password boolean not null default true,
  recinto_id uuid references public.recintos(id) on delete set null,
  province text,
  canton text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_one_active_coordinator_per_recinto
  on public.profiles (recinto_id)
  where role = 'coordinador_recinto' and active and recinto_id is not null;

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dignidad public.dignidad not null,
  full_name text not null,
  list_number integer not null check (list_number > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, dignidad)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  veedor_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  active boolean not null default true,
  replaces_assignment_id uuid references public.assignments(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists assignments_one_active_per_mesa
  on public.assignments (mesa_id)
  where active;

create table if not exists public.actas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete restrict,
  dignidad public.dignidad not null,
  version integer not null default 1 check (version > 0),
  estado public.acta_status not null default 'en_proceso',
  registrado_por uuid references public.profiles(id) on delete set null,
  corregido_por uuid references public.profiles(id) on delete set null,
  gps_lat double precision not null,
  gps_lng double precision not null,
  gps_precision double precision not null check (gps_precision >= 0),
  foto_path text not null,
  total_sufragantes integer not null check (total_sufragantes >= 0),
  votos_validos integer not null check (votos_validos >= 0),
  votos_blancos integer not null check (votos_blancos >= 0),
  votos_nulos integer not null check (votos_nulos >= 0),
  observaciones text,
  operacion_cliente_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mesa_id, dignidad),
  check (votos_validos + votos_blancos + votos_nulos = total_sufragantes)
);

create table if not exists public.vote_details (
  id uuid primary key default gen_random_uuid(),
  acta_id uuid not null references public.actas(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  votos integer not null check (votos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (acta_id, candidate_id)
);

create table if not exists public.acta_edit_conflicts (
  id uuid primary key default gen_random_uuid(),
  acta_id uuid references public.actas(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  dignidad public.dignidad not null,
  base_version integer not null check (base_version >= 0),
  remote_version integer not null check (remote_version > 0),
  local_version integer not null check (local_version >= 0),
  detected_by uuid references public.profiles(id) on delete set null,
  payload jsonb not null,
  status public.conflict_status not null default 'detectado',
  reviewed_by uuid references public.profiles(id) on delete set null,
  resolution jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists index_mesas_recinto_id on public.mesas (recinto_id);
create index if not exists index_assignments_veedor_id on public.assignments (veedor_id);
create index if not exists index_assignments_mesa_id on public.assignments (mesa_id);
create index if not exists index_actas_mesa_id on public.actas (mesa_id);
create index if not exists index_vote_details_acta_id on public.vote_details (acta_id);
create index if not exists index_conflicts_acta_id on public.acta_edit_conflicts (acta_id);
create index if not exists index_conflicts_status on public.acta_edit_conflicts (status);
create index if not exists index_conflicts_mesa_id on public.acta_edit_conflicts (mesa_id);
create index if not exists index_conflicts_detected_by on public.acta_edit_conflicts (detected_by);
create index if not exists index_conflicts_reviewed_by on public.acta_edit_conflicts (reviewed_by);
create index if not exists index_actas_registrado_por on public.actas (registrado_por);
create index if not exists index_actas_corregido_por on public.actas (corregido_por);
create index if not exists index_assignments_assigned_by on public.assignments (assigned_by);
create index if not exists index_assignments_replaces on public.assignments (replaces_assignment_id);
create index if not exists index_vote_details_organization_id on public.vote_details (organization_id);
create index if not exists index_vote_details_candidate_id on public.vote_details (candidate_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();

drop trigger if exists recintos_set_updated_at on public.recintos;
create trigger recintos_set_updated_at before update on public.recintos for each row execute function public.set_updated_at();

drop trigger if exists mesas_set_updated_at on public.mesas;
create trigger mesas_set_updated_at before update on public.mesas for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists candidates_set_updated_at on public.candidates;
create trigger candidates_set_updated_at before update on public.candidates for each row execute function public.set_updated_at();

drop trigger if exists vote_details_set_updated_at on public.vote_details;
create trigger vote_details_set_updated_at before update on public.vote_details for each row execute function public.set_updated_at();

create schema if not exists private;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create or replace function private.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid() and p.active
  limit 1;
$$;

create or replace function private.can_access_recinto(p_recinto_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from private.current_profile();
  if not found or not v_profile.active then
    return false;
  end if;

  if v_profile.role = 'coordinador_provincial' then
    return exists (
      select 1 from public.recintos r
      where r.id = p_recinto_id and r.province = v_profile.province and r.canton = v_profile.canton
    );
  end if;
  if v_profile.role = 'coordinador_recinto' then
    return v_profile.recinto_id = p_recinto_id;
  end if;
  if v_profile.role = 'veedor' then
    return exists (
      select 1
      from public.mesas m
      join public.assignments a on a.mesa_id = m.id
      where m.recinto_id = p_recinto_id and a.veedor_id = v_profile.id and a.active
    );
  end if;
  return false;
end;
$$;

create or replace function private.can_edit_recinto(p_recinto_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from private.current_profile();
  if not found or not v_profile.active then
    return false;
  end if;

  if v_profile.role = 'coordinador_provincial' then
    return exists (
      select 1 from public.recintos r
      where r.id = p_recinto_id and r.province = v_profile.province and r.canton = v_profile.canton
    );
  end if;
  if v_profile.role = 'coordinador_recinto' then
    return v_profile.recinto_id = p_recinto_id;
  end if;
  return false;
end;
$$;

create or replace function private.can_access_mesa(p_mesa_id uuid)
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
      select 1 from public.assignments a
      where a.mesa_id = p_mesa_id and a.veedor_id = v_profile.id and a.active
    );
  end if;

  select recinto_id into v_recinto_id from public.mesas where id = p_mesa_id;
  if not found then
    return false;
  end if;
  return private.can_edit_recinto(v_recinto_id);
end;
$$;

create or replace function private.can_edit_mesa(p_mesa_id uuid)
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
  if not found or not v_profile.active or v_profile.role = 'veedor' then
    return false;
  end if;

  select recinto_id into v_recinto_id from public.mesas where id = p_mesa_id;
  if not found then
    return false;
  end if;
  return private.can_edit_recinto(v_recinto_id);
end;
$$;

create or replace function private.can_edit_acta(p_acta_id uuid)
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

create or replace function private.can_resolve_conflict(p_acta_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles;
  v_mesa_id uuid;
  v_recinto_id uuid;
begin
  select * into v_profile from private.current_profile();
  if not found or not v_profile.active or v_profile.role = 'veedor' then
    return false;
  end if;

  select a.mesa_id into v_mesa_id from public.actas a where a.id = p_acta_id;
  if not found then
    return false;
  end if;
  select m.recinto_id into v_recinto_id from public.mesas m where m.id = v_mesa_id;
  if not found then
    return false;
  end if;
  return private.can_edit_recinto(v_recinto_id);
end;
$$;

create or replace function public.touch_acta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    new.dignidad is distinct from old.dignidad
    or new.gps_lat is distinct from old.gps_lat
    or new.gps_lng is distinct from old.gps_lng
    or new.gps_precision is distinct from old.gps_precision
    or new.foto_path is distinct from old.foto_path
    or new.total_sufragantes is distinct from old.total_sufragantes
    or new.votos_validos is distinct from old.votos_validos
    or new.votos_blancos is distinct from old.votos_blancos
    or new.votos_nulos is distinct from old.votos_nulos
  ) then
    new.version = old.version + 1;
    new.corregido_por = coalesce(new.corregido_por, auth.uid());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists actas_set_updated_at on public.actas;
create trigger actas_set_updated_at before update on public.actas for each row execute function public.touch_acta();

create or replace function public.validate_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old_mesa_id uuid;
begin
  if (select role from public.profiles where id = new.veedor_id) is distinct from 'veedor'::public.user_role then
    raise exception 'EL_USUARIO_ASIGNADO_DEBE_SER_VEEDOR';
  end if;

  if new.active is false and new.unassigned_at is null then
    new.unassigned_at = now();
  end if;

  if new.replaces_assignment_id is not null then
    select mesa_id into v_old_mesa_id from public.assignments where id = new.replaces_assignment_id;
    if v_old_mesa_id is distinct from new.mesa_id then
      raise exception 'EL_REEMPLAZO_DEBE_SER_PARA_LA_MISMA_MESA';
    end if;
    update public.assignments
    set active = false, unassigned_at = now()
    where id = new.replaces_assignment_id;
  end if;

  return new;
end;
$$;

drop trigger if exists assignments_validate on public.assignments;
create trigger assignments_validate before insert or update on public.assignments for each row execute function public.validate_assignment();

create or replace function public.validate_vote_detail()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_acta public.actas;
begin
  select * into v_acta from public.actas where id = new.acta_id;

  if v_acta.id is null then
    raise exception 'ACTA_NO_EXISTE';
  end if;

  if new.votos < 0 or new.votos > v_acta.total_sufragantes then
    raise exception 'VOTO_FUERA_DE_RANGO';
  end if;

  if exists (
    select 1
    from public.candidates c
    where c.id = new.candidate_id
      and (c.dignidad <> v_acta.dignidad or c.organization_id <> new.organization_id)
  ) then
    raise exception 'CANDIDATO_NO_CORRESPONDE_AL_ACTA';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vote_details_validate on public.vote_details;
create trigger vote_details_validate before insert or update on public.vote_details for each row execute function public.validate_vote_detail();

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

  update public.profiles
  set must_change_password = false, updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.completar_cambio_clave()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform private.completar_cambio_clave();
end;
$$;

create or replace function public.sync_profile_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.profiles
  set email_verified = (new.email_confirmed_at is not null), updated_at = now()
  where id = new.id;
  return new;
end;
$$;

revoke all on function public.sync_profile_email_verified() from public, anon, authenticated;
grant execute on function public.sync_profile_email_verified() to postgres, service_role;

drop trigger if exists on_auth_user_email_verified on auth.users;
create trigger on_auth_user_email_verified
after update of email_confirmed_at on auth.users
for each row execute function public.sync_profile_email_verified();

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
security invoker
set search_path = public
as $$
declare
  v_acta public.actas;
  v_votos_candidatos integer;
begin
  if not private.can_access_mesa(p_mesa_id) then
    raise exception 'SIN_PERMISO_PARA_LA_MESA';
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
security invoker
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_veedor public.profiles;
  v_recinto_id uuid;
  v_mesa_id uuid;
  v_assignment public.assignments;
begin
  select * into v_profile from private.current_profile();
  if not found or v_profile.role not in ('coordinador_provincial', 'coordinador_recinto') then
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
security invoker
set search_path = public
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
  if not found or v_profile.role not in ('coordinador_provincial', 'coordinador_recinto') then
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

grant execute on function public.asignar_veedor(uuid[], uuid, text) to authenticated;
grant execute on function public.reemplazar_veedor(uuid[], uuid, uuid, text) to authenticated;
revoke all on function public.asignar_veedor(uuid[], uuid, text) from public, anon;
revoke all on function public.reemplazar_veedor(uuid[], uuid, uuid, text) from public, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('actas', 'actas', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
        where a.foto_path = p_object_name and private.can_edit_acta(a.id)
      );
$$;

drop policy if exists actas_photos_select on storage.objects;
create policy actas_photos_select on storage.objects for select to authenticated
using (bucket_id = 'actas' and private.can_access_acta_photo(name));

drop policy if exists actas_photos_insert on storage.objects;
create policy actas_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'actas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists actas_photos_update on storage.objects;
create policy actas_photos_update on storage.objects for update to authenticated
using (bucket_id = 'actas' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'actas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists actas_photos_delete on storage.objects;
create policy actas_photos_delete on storage.objects for delete to authenticated
using (bucket_id = 'actas' and (storage.foldername(name))[1] = (select auth.uid())::text);

grant execute on function private.can_access_acta_photo(text) to authenticated;
revoke all on function private.can_access_acta_photo(text) from public, anon;

alter table public.organizations enable row level security;
alter table public.recintos enable row level security;
alter table public.mesas enable row level security;
alter table public.jrv_members enable row level security;
alter table public.profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.assignments enable row level security;
alter table public.actas enable row level security;
alter table public.vote_details enable row level security;
alter table public.acta_edit_conflicts enable row level security;

grant usage on schema public to authenticated;
grant select on public.organizations, public.candidates to authenticated;
grant select, insert, update, delete on public.recintos, public.mesas, public.jrv_members, public.profiles, public.assignments, public.actas, public.vote_details, public.acta_edit_conflicts to authenticated;
grant insert, update, delete on public.organizations, public.candidates to authenticated;
grant execute on function private.current_profile(), private.can_access_recinto(uuid), private.can_edit_recinto(uuid), private.can_access_mesa(uuid), private.can_edit_mesa(uuid), private.can_edit_acta(uuid), private.can_resolve_conflict(uuid), private.completar_cambio_clave(), public.completar_cambio_clave(), public.registrar_acta(uuid, uuid, public.dignidad, integer, integer, integer, integer, integer, double precision, double precision, double precision, text, text, jsonb) to authenticated;
revoke all on function private.current_profile(), private.can_access_recinto(uuid), private.can_edit_recinto(uuid), private.can_access_mesa(uuid), private.can_edit_mesa(uuid), private.can_edit_acta(uuid), private.can_resolve_conflict(uuid), private.completar_cambio_clave(), public.completar_cambio_clave() from public, anon;
revoke all on function public.current_profile(), public.can_access_recinto(uuid), public.can_edit_recinto(uuid), public.can_access_mesa(uuid), public.can_edit_mesa(uuid), public.can_edit_acta(uuid), public.can_resolve_conflict(uuid) from public, anon, authenticated;
drop function if exists public.current_profile();
drop function if exists public.can_access_recinto(uuid);
drop function if exists public.can_edit_recinto(uuid);
drop function if exists public.can_access_mesa(uuid);
drop function if exists public.can_edit_mesa(uuid);
drop function if exists public.can_edit_acta(uuid);
drop function if exists public.can_resolve_conflict(uuid);

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated using (true);

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations for insert to authenticated with check (
  exists (select 1 from private.current_profile() cp where cp.role = 'coordinador_provincial')
);

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated using (
  exists (select 1 from private.current_profile() cp where cp.role = 'coordinador_provincial')
) with check (
  exists (select 1 from private.current_profile() cp where cp.role = 'coordinador_provincial')
);

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations for delete to authenticated using (
  exists (select 1 from private.current_profile() cp where cp.role = 'coordinador_provincial')
);

drop policy if exists candidates_select on public.candidates;
create policy candidates_select on public.candidates for select to authenticated using (true);

drop policy if exists candidates_insert on public.candidates;
create policy candidates_insert on public.candidates for insert to authenticated with check (
  exists (select 1 from private.current_profile() cp where cp.role = 'coordinador_provincial')
);

drop policy if exists candidates_update on public.candidates;
create policy candidates_update on public.candidates for update to authenticated using (
  exists (select 1 from private.current_profile() cp where cp.role = 'coordinador_provincial')
) with check (
  exists (select 1 from private.current_profile() cp where cp.role = 'coordinador_provincial')
);

drop policy if exists candidates_delete on public.candidates;
create policy candidates_delete on public.candidates for delete to authenticated using (
  exists (select 1 from private.current_profile() cp where cp.role = 'coordinador_provincial')
);

drop policy if exists recintos_select on public.recintos;
create policy recintos_select on public.recintos for select to authenticated using (
  private.can_access_recinto(recintos.id)
);

drop policy if exists recintos_insert on public.recintos;
create policy recintos_insert on public.recintos for insert to authenticated with check (
  exists (
    select 1 from private.current_profile() cp
    where cp.role = 'coordinador_provincial' and recintos.province = cp.province and recintos.canton = cp.canton
  )
);

drop policy if exists recintos_update on public.recintos;
create policy recintos_update on public.recintos for update to authenticated using (
  exists (
    select 1 from private.current_profile() cp
    where cp.active and (
      (
        cp.role = 'coordinador_provincial'
        and recintos.province = cp.province
        and recintos.canton = cp.canton
      )
      or (cp.role = 'coordinador_recinto' and cp.recinto_id = recintos.id)
    )
  )
) with check (
  exists (
    select 1 from private.current_profile() cp
    where cp.active and (
      (
        cp.role = 'coordinador_provincial'
        and recintos.province = cp.province
        and recintos.canton = cp.canton
      )
      or (cp.role = 'coordinador_recinto' and cp.recinto_id = recintos.id)
    )
  )
);

drop policy if exists recintos_delete on public.recintos;
create policy recintos_delete on public.recintos for delete to authenticated using (
  exists (
    select 1 from private.current_profile() cp
    where cp.active and (
      (
        cp.role = 'coordinador_provincial'
        and recintos.province = cp.province
        and recintos.canton = cp.canton
      )
      or (cp.role = 'coordinador_recinto' and cp.recinto_id = recintos.id)
    )
  )
);

drop policy if exists mesas_select on public.mesas;
create policy mesas_select on public.mesas for select to authenticated using (
  exists (
    select 1
    from private.current_profile() cp
    where cp.active and (
      (cp.role <> 'veedor' and private.can_edit_recinto(mesas.recinto_id))
      or (
        cp.role = 'veedor'
        and exists (
          select 1 from public.assignments a
          where a.mesa_id = mesas.id and a.veedor_id = cp.id and a.active
        )
      )
    )
  )
);

drop policy if exists mesas_insert on public.mesas;
create policy mesas_insert on public.mesas for insert to authenticated with check (private.can_edit_recinto(recinto_id));

drop policy if exists mesas_update on public.mesas;
create policy mesas_update on public.mesas for update to authenticated using (
  exists (
    select 1
    from private.current_profile() cp
    where cp.active and (
      (cp.role <> 'veedor' and private.can_edit_recinto(mesas.recinto_id))
      or (
        cp.role = 'veedor'
        and exists (
          select 1 from public.assignments a
          where a.mesa_id = mesas.id and a.veedor_id = cp.id and a.active
        )
      )
    )
  )
) with check (
  exists (
    select 1
    from private.current_profile() cp
    where cp.active and (
      (cp.role <> 'veedor' and private.can_edit_recinto(mesas.recinto_id))
      or (
        cp.role = 'veedor'
        and exists (
          select 1 from public.assignments a
          where a.mesa_id = mesas.id and a.veedor_id = cp.id and a.active
        )
      )
    )
  )
);

drop policy if exists mesas_delete on public.mesas;
create policy mesas_delete on public.mesas for delete to authenticated using (
  exists (
    select 1
    from private.current_profile() cp
    where cp.active and cp.role <> 'veedor' and private.can_edit_recinto(mesas.recinto_id)
  )
);

drop policy if exists jrv_members_select on public.jrv_members;
create policy jrv_members_select on public.jrv_members for select to authenticated using (
  private.can_access_mesa(mesa_id)
);

drop policy if exists jrv_members_insert on public.jrv_members;
create policy jrv_members_insert on public.jrv_members for insert to authenticated with check (
  private.can_edit_mesa(mesa_id)
);

drop policy if exists jrv_members_update on public.jrv_members;
create policy jrv_members_update on public.jrv_members for update to authenticated using (
  private.can_edit_mesa(mesa_id)
) with check (
  private.can_edit_mesa(mesa_id)
);

drop policy if exists jrv_members_delete on public.jrv_members;
create policy jrv_members_delete on public.jrv_members for delete to authenticated using (
  private.can_edit_mesa(mesa_id)
);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1
    from private.current_profile() cp
    where cp.active
      and (
        (
          cp.role = 'coordinador_provincial'
          and public.profiles.province = cp.province
          and public.profiles.canton = cp.canton
        )
        or (cp.role = 'coordinador_recinto' and public.profiles.recinto_id = cp.recinto_id)
      )
  )
);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (
  exists (
    select 1
    from private.current_profile() cp
    where cp.active
      and (
        (
          cp.role = 'coordinador_provincial'
          and public.profiles.role = 'coordinador_recinto'
          and public.profiles.province = cp.province
          and public.profiles.canton = cp.canton
        )
        or (
          cp.role = 'coordinador_recinto'
          and public.profiles.role = 'veedor'
          and public.profiles.recinto_id = cp.recinto_id
        )
      )
  )
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (
  exists (
    select 1
    from private.current_profile() cp
    where cp.active
      and (
        (
          cp.role = 'coordinador_provincial'
          and public.profiles.role = 'coordinador_recinto'
          and public.profiles.province = cp.province
          and public.profiles.canton = cp.canton
        )
        or (
          cp.role = 'coordinador_recinto'
          and public.profiles.role = 'veedor'
          and public.profiles.recinto_id = cp.recinto_id
        )
      )
  )
) with check (
  exists (
    select 1
    from private.current_profile() cp
    where cp.active
      and (
        (
          cp.role = 'coordinador_provincial'
          and public.profiles.role = 'coordinador_recinto'
          and public.profiles.province = cp.province
          and public.profiles.canton = cp.canton
        )
        or (
          cp.role = 'coordinador_recinto'
          and public.profiles.role = 'veedor'
          and public.profiles.recinto_id = cp.recinto_id
        )
      )
  )
);

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated using (
  exists (
    select 1
    from private.current_profile() cp
    where cp.active
      and (
        (
          cp.role = 'coordinador_provincial'
          and public.profiles.role = 'coordinador_recinto'
          and public.profiles.province = cp.province
          and public.profiles.canton = cp.canton
        )
        or (
          cp.role = 'coordinador_recinto'
          and public.profiles.role = 'veedor'
          and public.profiles.recinto_id = cp.recinto_id
        )
      )
  )
);

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated using (
  exists (select 1 from private.current_profile() cp where cp.role = 'veedor' and cp.id = veedor_id)
  or private.can_edit_mesa(mesa_id)
);

drop policy if exists assignments_insert on public.assignments;
create policy assignments_insert on public.assignments for insert to authenticated with check (
  private.can_edit_mesa(mesa_id)
);

drop policy if exists assignments_update on public.assignments;
create policy assignments_update on public.assignments for update to authenticated using (
  private.can_edit_mesa(mesa_id)
) with check (
  private.can_edit_mesa(mesa_id)
);

drop policy if exists assignments_delete on public.assignments;
create policy assignments_delete on public.assignments for delete to authenticated using (
  private.can_edit_mesa(mesa_id)
);

drop policy if exists actas_select on public.actas;
create policy actas_select on public.actas for select to authenticated using (private.can_access_mesa(mesa_id));

drop policy if exists actas_insert on public.actas;
create policy actas_insert on public.actas for insert to authenticated with check (
  private.can_access_mesa(mesa_id) and registrado_por = (select auth.uid())
);

drop policy if exists actas_update on public.actas;
create policy actas_update on public.actas for update to authenticated using (private.can_access_mesa(mesa_id)) with check (private.can_access_mesa(mesa_id));

drop policy if exists actas_delete on public.actas;
create policy actas_delete on public.actas for delete to authenticated using (
  private.can_edit_mesa(mesa_id)
);

drop policy if exists vote_details_select on public.vote_details;
create policy vote_details_select on public.vote_details for select to authenticated using (
  private.can_edit_acta(acta_id)
);

drop policy if exists vote_details_insert on public.vote_details;
create policy vote_details_insert on public.vote_details for insert to authenticated with check (
  private.can_edit_acta(acta_id)
);

drop policy if exists vote_details_update on public.vote_details;
create policy vote_details_update on public.vote_details for update to authenticated using (
  private.can_edit_acta(acta_id)
) with check (
  private.can_edit_acta(acta_id)
);

drop policy if exists vote_details_delete on public.vote_details;
create policy vote_details_delete on public.vote_details for delete to authenticated using (
  private.can_edit_acta(acta_id)
);

drop policy if exists conflicts_select on public.acta_edit_conflicts;
create policy conflicts_select on public.acta_edit_conflicts for select to authenticated using (
  acta_id is not null and private.can_edit_acta(acta_id)
  or private.can_edit_mesa(mesa_id)
);

drop policy if exists conflicts_insert on public.acta_edit_conflicts;
create policy conflicts_insert on public.acta_edit_conflicts for insert to authenticated with check (
  private.can_access_mesa(mesa_id) and (acta_id is null or private.can_edit_acta(acta_id))
);

drop policy if exists conflicts_update on public.acta_edit_conflicts;
create policy conflicts_update on public.acta_edit_conflicts for update to authenticated using (
  private.can_resolve_conflict(acta_id) or (acta_id is null and private.can_edit_mesa(mesa_id))
) with check (
  private.can_resolve_conflict(acta_id) or (acta_id is null and private.can_edit_mesa(mesa_id))
);

drop policy if exists conflicts_delete on public.acta_edit_conflicts;
create policy conflicts_delete on public.acta_edit_conflicts for delete to authenticated using (private.can_resolve_conflict(acta_id));
