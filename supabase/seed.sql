create extension if not exists pgcrypto;

with seeded_users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at) as (
  values
    ('00000000-0000-0000-0000-000000000000'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'authenticated', 'authenticated', 'coordinador.provincial@adn.ec', crypt('Adn2026!', gen_salt('bf', 10)), now(), jsonb_build_object('role', 'coordinador_provincial', 'must_change_password', true), now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 'authenticated', 'authenticated', 'coordinador.recinto@adn.ec', crypt('Adn2026!', gen_salt('bf', 10)), now(), jsonb_build_object('role', 'coordinador_recinto', 'must_change_password', true), now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 'authenticated', 'authenticated', 'veedor.uno@adn.ec', crypt('Adn2026!', gen_salt('bf', 10)), now(), jsonb_build_object('role', 'veedor', 'must_change_password', true), now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, 'authenticated', 'authenticated', 'veedor.dos@adn.ec', crypt('Adn2026!', gen_salt('bf', 10)), now(), jsonb_build_object('role', 'veedor', 'must_change_password', true), now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 'authenticated', 'authenticated', 'veedor.tres@adn.ec', crypt('Adn2026!', gen_salt('bf', 10)), now(), jsonb_build_object('role', 'veedor', 'must_change_password', true), now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 'authenticated', 'authenticated', 'veedor.cuatro@adn.ec', crypt('Adn2026!', gen_salt('bf', 10)), now(), jsonb_build_object('role', 'veedor', 'must_change_password', false), now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, '77777777-7777-4777-8777-777777777777'::uuid, 'authenticated', 'authenticated', 'coordinador.guayas@adn.ec', crypt('Adn2026!', gen_salt('bf', 10)), now(), jsonb_build_object('role', 'coordinador_provincial', 'must_change_password', true), now(), now())
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
from seeded_users v
where not exists (select 1 from auth.users u where u.email = v.email)
on conflict (id) do nothing;

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  instance_id = coalesce(instance_id, '00000000-0000-0000-0000-000000000000'::uuid)
where email in (
  'coordinador.provincial@adn.ec',
  'coordinador.guayas@adn.ec',
  'coordinador.recinto@adn.ec',
  'veedor.uno@adn.ec',
  'veedor.dos@adn.ec',
  'veedor.tres@adn.ec',
  'veedor.cuatro@adn.ec'
);

update auth.users
set
  encrypted_password = crypt('Adn2026!', gen_salt('bf', 10)),
  email_confirmed_at = now(),
  last_sign_in_at = null,
  raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{must_change_password}', 'true'::jsonb),
  updated_at = now()
where lower(email) = 'veedor.dos@adn.ec';

delete from auth.sessions where user_id = '44444444-4444-4444-8444-444444444444'::uuid;
delete from auth.refresh_tokens where user_id = '44444444-4444-4444-8444-444444444444';

update auth.users
set
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change = '',
  email_change_token_current = '',
  reauthentication_token = '',
  phone_change = '',
  phone_change_token = '',
  updated_at = now()
where email in (
  'coordinador.provincial@adn.ec',
  'coordinador.guayas@adn.ec',
  'coordinador.recinto@adn.ec',
  'veedor.uno@adn.ec',
  'veedor.dos@adn.ec',
  'veedor.tres@adn.ec',
  'veedor.cuatro@adn.ec'
);

with seeded_identities(id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at) as (
  values
    ('a1111111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111', 'email', jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'email', 'coordinador.provincial@adn.ec', 'email_verified', true), now(), now(), now()),
    ('a7777777-7777-4777-8777-777777777777'::uuid, '77777777-7777-4777-8777-777777777777'::uuid, '77777777-7777-4777-8777-777777777777', 'email', jsonb_build_object('sub', '77777777-7777-4777-8777-777777777777', 'email', 'coordinador.guayas@adn.ec', 'email_verified', true), now(), now(), now()),
    ('a2222222-2222-4222-8222-222222222222'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, '22222222-2222-4222-8222-222222222222', 'email', jsonb_build_object('sub', '22222222-2222-4222-8222-222222222222', 'email', 'coordinador.recinto@adn.ec', 'email_verified', true), now(), now(), now()),
    ('a3333333-3333-4333-8333-333333333333'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, '33333333-3333-4333-8333-333333333333', 'email', jsonb_build_object('sub', '33333333-3333-4333-8333-333333333333', 'email', 'veedor.uno@adn.ec', 'email_verified', true), now(), now(), now()),
    ('a4444444-4444-4444-8444-444444444444'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, '44444444-4444-4444-8444-444444444444', 'email', jsonb_build_object('sub', '44444444-4444-4444-8444-444444444444', 'email', 'veedor.dos@adn.ec', 'email_verified', true), now(), now(), now()),
    ('a5555555-5555-4555-8555-555555555555'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, '55555555-5555-4555-8555-555555555555', 'email', jsonb_build_object('sub', '55555555-5555-4555-8555-555555555555', 'email', 'veedor.tres@adn.ec', 'email_verified', true), now(), now(), now()),
    ('a6666666-6666-4666-8666-666666666666'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, '66666666-6666-4666-8666-666666666666', 'email', jsonb_build_object('sub', '66666666-6666-4666-8666-666666666666', 'email', 'veedor.cuatro@adn.ec', 'email_verified', true), now(), now(), now())
)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
from seeded_identities v
where not exists (
  select 1 from auth.identities i
  where i.user_id = v.user_id and i.provider = 'email'
     or i.provider_id = v.provider_id
)
on conflict (id) do nothing;

with seeded_organizations as (
  insert into public.organizations (name, short_name, list_number, primary_color, secondary_color)
  values
    ('Acción Democrática Nacional', 'ADN', 7, '#9854B3', '#FFEC4E'),
    ('Unión Ecuatoriana', 'UNES', 1, '#C8102E', '#FFFFFF'),
    ('Izquierda Democrática', 'ID', 2, '#E30613', '#FFFFFF'),
    ('Creando Oportunidades', 'CREO', 3, '#005CA9', '#FFFFFF'),
    ('Partido Social Cristiano', 'PSC', 5, '#0056A4', '#E10600')
  on conflict (list_number) do update set
    name = excluded.name,
    short_name = excluded.short_name,
    primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    updated_at = now()
  returning id, list_number
)
insert into public.candidates (organization_id, dignidad, full_name, list_number)
select o.id, 'alcaldia'::public.dignidad, v.full_name, o.list_number
from seeded_organizations o
join (
  values
    (7, 'Jairo Efraín Maigua Aimacaña'),
    (1, 'Lucía Cordero Viteri'),
    (2, 'Fernando Bustamante Rivadeneira'),
    (3, 'Oscar Julián Vázquez Borja'),
    (5, 'Andrés Carrión Salgado')
) as v(list_number, full_name) on v.list_number = o.list_number
on conflict (organization_id, dignidad) do update set
  full_name = excluded.full_name,
  list_number = excluded.list_number,
  active = true,
  updated_at = now();

with seeded_organizations as (
  select id, list_number from public.organizations
  where list_number in (1, 2, 3, 5, 7)
)
insert into public.candidates (organization_id, dignidad, full_name, list_number)
select o.id, 'prefectura'::public.dignidad, v.full_name, o.list_number
from seeded_organizations o
join (
  values
    (7, 'Milka Elizabeth Borja Quinto'),
    (1, 'Ramiro Salgado Cabezas'),
    (2, 'Carla Rivadeneira Mosquera'),
    (3, 'Kevin Alexander Amagua Valenzuela'),
    (5, 'María José Viteri Andrade')
) as v(list_number, full_name) on v.list_number = o.list_number
on conflict (organization_id, dignidad) do update set
  full_name = excluded.full_name,
  list_number = excluded.list_number,
  active = true,
  updated_at = now();

with seeded_recintos as (
  insert into public.recintos (code, name, address, province, canton, parish, gps_lat, gps_lng)
  values
    ('QTO-001', 'Unidad Educativa Quito Sur', 'Av. Amazonas y Veintimilla, Quito', 'Pichincha', 'Quito', 'San Francisco', -0.1807, -78.4678),
    ('QTO-002', 'Colegio Nacional Técnico', 'Av. Amazónicas y Veintimilla, Quito', 'Pichincha', 'Quito', 'La Vicentina', -0.2105, -78.5100),
    ('QTO-003', 'Centro Comunitario La Floresta', 'Av. 12 de Octubre y Cordero, Quito', 'Pichincha', 'Quito', 'La Floresta', -0.1540, -78.4740),
    ('QTO-004', 'Recinto QTO-004', 'Quito', 'Pichincha', 'Quito', 'San Francisco', -0.1807, -78.4678),
    ('GYE-001', 'Unidad Educativa Guayaquil Norte', 'Av. 9 de Octubre y Machala, Guayaquil', 'Guayas', 'Guayaquil', 'Guayaquil', -2.1700, -79.9224),
    ('GYE-002', 'Colegio Nacional Guayas', 'Av. Quito y Venezuela, Guayaquil', 'Guayas', 'Guayaquil', 'Guayaquil', -2.1850, -79.9180)
  on conflict (code) do update set
    name = excluded.name,
    address = excluded.address,
    province = excluded.province,
    canton = excluded.canton,
    parish = excluded.parish,
    gps_lat = excluded.gps_lat,
    gps_lng = excluded.gps_lng,
    updated_at = now()
  returning id, code
)
insert into public.mesas (recinto_id, number, registered_voters, location)
select r.id, m.number, m.registered_voters, m.location
from seeded_recintos r
join (
  values
    ('QTO-001', '001', 312, 'Bloque A - Aula 1'),
    ('QTO-001', '002', 298, 'Bloque A - Aula 2'),
    ('QTO-001', '003', 275, 'Bloque B - Aula 3'),
    ('QTO-002', '001', 330, 'Bloque Central - Aula 1'),
    ('QTO-002', '002', 287, 'Bloque Central - Aula 2'),
    ('QTO-002', '003', 301, 'Bloque Norte - Aula 3'),
    ('QTO-003', '001', 264, 'Sala Principal'),
    ('QTO-003', '002', 289, 'Sala Secundaria'),
    ('QTO-003', '003', 318, 'Sala Comunitaria'),
    ('QTO-004', '001', 300, 'QTO-004 · Aula 1'),
    ('QTO-004', '002', 280, 'QTO-004 · Aula 2'),
    ('QTO-004', '003', 260, 'QTO-004 · Aula 3'),
    ('GYE-001', '001', 305, 'Bloque Norte - Aula 1'),
    ('GYE-001', '002', 290, 'Bloque Norte - Aula 2'),
    ('GYE-002', '001', 318, 'Bloque Central - Aula 1'),
    ('GYE-002', '002', 276, 'Bloque Central - Aula 2')
) as m(code, number, registered_voters, location) on m.code = r.code
on conflict (recinto_id, number) do update set
  registered_voters = excluded.registered_voters,
  location = excluded.location,
  active = true,
  updated_at = now();

insert into public.jrv_members (mesa_id, role, full_name, cedula)
select m.id, v.role, v.full_name, v.cedula
from public.mesas m
join public.recintos r on r.id = m.recinto_id
join (
  values
    ('QTO-001', '001', 'presidente', 'Ana María Cedeño', '1700000068'),
    ('QTO-001', '001', 'secretario', 'Luis Fernando Cedeño', '1700000076'),
    ('QTO-002', '001', 'presidente', 'Diana Patricia Moreno', '1700000084'),
    ('QTO-003', '001', 'presidente', 'Carlos Alberto Rivadeneira', '1700000092')
) as v(code, mesa_number, role, full_name, cedula)
  on v.code = r.code and v.mesa_number = m.number
on conflict (mesa_id, role) do update set
  full_name = excluded.full_name,
  cedula = excluded.cedula;

with seeded_profiles(id, role, cedula, first_name, last_name, phone, email, email_verified, must_change_password, recinto_id, province, canton) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'coordinador_provincial'::public.user_role, '1700000001', 'Jairo Efraín', 'Maigua Aimacaña', '0980000001', 'coordinador.provincial@adn.ec', true, true, null::uuid, 'Pichincha', 'Quito'),
    ('77777777-7777-4777-8777-777777777777'::uuid, 'coordinador_provincial'::public.user_role, '0900000019', 'Carlos Alberto', 'Guerrero Valencia', '0980000007', 'coordinador.guayas@adn.ec', true, true, null::uuid, 'Guayas', 'Guayaquil'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'coordinador_recinto'::public.user_role, '1700000019', 'Oscar Julián', 'Vázquez Borja', '0980000002', 'coordinador.recinto@adn.ec', true, true, (select id from public.recintos where code = 'QTO-001'), 'Pichincha', 'Quito'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'veedor'::public.user_role, '1700000027', 'Milka Elizabeth', 'Borja Quinto', '0980000003', 'veedor.uno@adn.ec', true, true, (select id from public.recintos where code = 'QTO-001'), 'Pichincha', 'Quito'),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'veedor'::public.user_role, '1700000035', 'Kevin Alexander', 'Amagua Valenzuela', '0980000004', 'veedor.dos@adn.ec', true, true, (select id from public.recintos where code = 'QTO-002'), 'Pichincha', 'Quito'),
    ('55555555-5555-4555-8555-555555555555'::uuid, 'veedor'::public.user_role, '1700000043', 'Carlos Alberto', 'Rivadeneira Mosquera', '0980000005', 'veedor.tres@adn.ec', true, true, (select id from public.recintos where code = 'QTO-003'), 'Pichincha', 'Quito'),
    ('66666666-6666-4666-8666-666666666666'::uuid, 'veedor'::public.user_role, '1700000051', 'Veedor', 'Cuatro', '0980000006', 'veedor.cuatro@adn.ec', true, false, (select id from public.recintos where code = 'QTO-004'), 'Pichincha', 'Quito')
)
insert into public.profiles (
  id, role, cedula, first_name, last_name, phone, email, email_verified,
  must_change_password, recinto_id, province, canton
)
select
  id,
  role,
  cedula,
  first_name,
  last_name,
  phone,
  email,
  email_verified,
  must_change_password,
  recinto_id,
  province,
  canton
from seeded_profiles v
where not exists (
  select 1 from public.profiles p where p.email = v.email or p.cedula = v.cedula
)
on conflict (id) do update set
  role = excluded.role,
  cedula = excluded.cedula,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone = excluded.phone,
  email = excluded.email,
  email_verified = excluded.email_verified,
  must_change_password = excluded.must_change_password,
  recinto_id = excluded.recinto_id,
  province = excluded.province,
  canton = excluded.canton,
  active = true,
  updated_at = now();

update public.profiles
set
  active = true,
  email_verified = true,
  updated_at = now()
where lower(email) = 'coordinador.recinto@adn.ec';

update public.profiles
set
  active = true,
  email_verified = true,
  must_change_password = true,
  updated_at = now()
where lower(email) = 'veedor.dos@adn.ec';

with target_assignments(id, code, mesa_number, veedor_email) as (
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'QTO-001', '001', 'veedor.uno@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid, 'QTO-001', '002', 'veedor.uno@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6'::uuid, 'QTO-001', '003', 'veedor.uno@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid, 'QTO-002', '001', 'veedor.dos@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7'::uuid, 'QTO-002', '002', 'veedor.dos@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8'::uuid, 'QTO-002', '003', 'veedor.dos@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid, 'QTO-003', '001', 'veedor.tres@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9'::uuid, 'QTO-003', '002', 'veedor.tres@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'::uuid, 'QTO-003', '003', 'veedor.tres@adn.ec')
)
update public.assignments a
set active = false,
    unassigned_at = coalesce(a.unassigned_at, now())
from public.mesas m
join public.recintos r on r.id = m.recinto_id
join target_assignments t on t.code = r.code and t.mesa_number = m.number
where a.mesa_id = m.id and a.active;

update public.assignments a
set active = false,
    unassigned_at = coalesce(a.unassigned_at, now())
from public.profiles p
where a.veedor_id = p.id
  and p.email in ('veedor.uno@adn.ec', 'veedor.dos@adn.ec', 'veedor.tres@adn.ec')
  and a.active;

with target_assignments(id, code, mesa_number, veedor_email) as (
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'QTO-001', '001', 'veedor.uno@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid, 'QTO-001', '002', 'veedor.uno@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6'::uuid, 'QTO-001', '003', 'veedor.uno@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid, 'QTO-002', '001', 'veedor.dos@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7'::uuid, 'QTO-002', '002', 'veedor.dos@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8'::uuid, 'QTO-002', '003', 'veedor.dos@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid, 'QTO-003', '001', 'veedor.tres@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9'::uuid, 'QTO-003', '002', 'veedor.tres@adn.ec'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'::uuid, 'QTO-003', '003', 'veedor.tres@adn.ec')
)
insert into public.assignments (
  id, mesa_id, veedor_id, assigned_by, active, unassigned_at, replaces_assignment_id, reason
)
select
  t.id,
  m.id,
  veedor.id,
  coordinador.id,
  true,
  null,
  null,
  'asignacion_inicial'
from target_assignments t
join public.recintos r on r.code = t.code
join public.mesas m on m.recinto_id = r.id and m.number = t.mesa_number
join public.profiles veedor on veedor.email = t.veedor_email
join public.profiles coordinador on coordinador.email = 'coordinador.recinto@adn.ec'
on conflict (id) do update set
  mesa_id = excluded.mesa_id,
  veedor_id = excluded.veedor_id,
  assigned_by = excluded.assigned_by,
  active = true,
  unassigned_at = null,
  replaces_assignment_id = null,
  reason = excluded.reason;

update public.assignments a
set active = false,
    unassigned_at = coalesce(a.unassigned_at, now())
from public.mesas m
join public.recintos r on r.id = m.recinto_id
where a.mesa_id = m.id
  and r.code = 'QTO-004'
  and a.active;

with target_assignments(id, mesa_number, veedor_email) as (
  values
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid, '001', 'veedor.cuatro@adn.ec'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid, '002', 'veedor.cuatro@adn.ec'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid, '003', 'veedor.cuatro@adn.ec')
)
insert into public.assignments (
  id, mesa_id, veedor_id, assigned_by, active, unassigned_at, replaces_assignment_id, reason
)
select
  t.id,
  m.id,
  v.id,
  (select id from public.profiles where email = 'coordinador.recinto@adn.ec'),
  true,
  null,
  null,
  'asignacion_inicial'
from target_assignments t
join public.recintos r on r.code = 'QTO-004'
join public.mesas m on m.recinto_id = r.id and m.number = t.mesa_number
join public.profiles v on v.email = t.veedor_email
on conflict (id) do update set
  mesa_id = excluded.mesa_id,
  veedor_id = excluded.veedor_id,
  assigned_by = excluded.assigned_by,
  active = true,
  unassigned_at = null,
  replaces_assignment_id = null,
  reason = excluded.reason;
