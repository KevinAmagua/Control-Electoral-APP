create extension if not exists pgcrypto;

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
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'coordinador.provincial@adn.ec',
    crypt('Adn2026!', gen_salt('bf')),
    now(),
    jsonb_build_object('role', 'coordinador_provincial', 'must_change_password', true),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'coordinador.recinto@adn.ec',
    crypt('Adn2026!', gen_salt('bf')),
    now(),
    jsonb_build_object('role', 'coordinador_recinto', 'must_change_password', true),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'veedor.uno@adn.ec',
    crypt('Adn2026!', gen_salt('bf')),
    now(),
    jsonb_build_object('role', 'veedor', 'must_change_password', true),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'veedor.dos@adn.ec',
    crypt('Adn2026!', gen_salt('bf')),
    now(),
    jsonb_build_object('role', 'veedor', 'must_change_password', true),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated',
    'authenticated',
    'veedor.tres@adn.ec',
    crypt('Adn2026!', gen_salt('bf')),
    now(),
    jsonb_build_object('role', 'veedor', 'must_change_password', true),
    now(),
    now()
  )
on conflict (id) do nothing;

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
  'coordinador.recinto@adn.ec',
  'veedor.uno@adn.ec',
  'veedor.dos@adn.ec',
  'veedor.tres@adn.ec'
);

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
values
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'email', jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'email', 'coordinador.provincial@adn.ec', 'email_verified', true), now(), now(), now()),
  ('a2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'email', jsonb_build_object('sub', '22222222-2222-4222-8222-222222222222', 'email', 'coordinador.recinto@adn.ec', 'email_verified', true), now(), now(), now()),
  ('a3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'email', jsonb_build_object('sub', '33333333-3333-4333-8333-333333333333', 'email', 'veedor.uno@adn.ec', 'email_verified', true), now(), now(), now()),
  ('a4444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444', 'email', jsonb_build_object('sub', '44444444-4444-4444-8444-444444444444', 'email', 'veedor.dos@adn.ec', 'email_verified', true), now(), now(), now()),
  ('a5555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555', 'email', jsonb_build_object('sub', '55555555-5555-4555-8555-555555555555', 'email', 'veedor.tres@adn.ec', 'email_verified', true), now(), now(), now())
on conflict (id) do nothing;

with seeded_organizations as (
  insert into public.organizations (name, short_name, list_number, primary_color, secondary_color)
  values
    ('Acción Democrática Nacional', 'ADN', 7, '#6F2C91', '#EAE84B'),
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
    ('QTO-003', 'Centro Comunitario La Floresta', 'Av. 12 de Octubre y Cordero, Quito', 'Pichincha', 'Quito', 'La Floresta', -0.1540, -78.4740)
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
    ('QTO-003', '003', 318, 'Sala Comunitaria')
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

insert into public.profiles (
  id, role, cedula, first_name, last_name, phone, email, email_verified,
  must_change_password, recinto_id, province, canton
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'coordinador_provincial',
    '1700000001',
    'Jairo Efraín',
    'Maigua Aimacaña',
    '0980000001',
    'coordinador.provincial@adn.ec',
    true,
    true,
    null,
    'Pichincha',
    'Quito'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'coordinador_recinto',
    '1700000019',
    'Oscar Julián',
    'Vázquez Borja',
    '0980000002',
    'coordinador.recinto@adn.ec',
    true,
    true,
    (select id from public.recintos where code = 'QTO-001'),
    'Pichincha',
    'Quito'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'veedor',
    '1700000027',
    'Milka Elizabeth',
    'Borja Quinto',
    '0980000003',
    'veedor.uno@adn.ec',
    true,
    true,
    (select id from public.recintos where code = 'QTO-001'),
    'Pichincha',
    'Quito'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'veedor',
    '1700000035',
    'Kevin Alexander',
    'Amagua Valenzuela',
    '0980000004',
    'veedor.dos@adn.ec',
    true,
    true,
    (select id from public.recintos where code = 'QTO-002'),
    'Pichincha',
    'Quito'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'veedor',
    '1700000043',
    'Carlos Alberto',
    'Rivadeneira Mosquera',
    '0980000005',
    'veedor.tres@adn.ec',
    true,
    true,
    (select id from public.recintos where code = 'QTO-003'),
    'Pichincha',
    'Quito'
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

insert into public.assignments (
  id, mesa_id, veedor_id, assigned_by, reason
)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  m.id,
  '33333333-3333-4333-8333-333333333333'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  'asignacion_inicial'
from public.mesas m
join public.recintos r on r.id = m.recinto_id
where r.code = 'QTO-001' and m.number = '001'
on conflict (id) do nothing;

insert into public.assignments (
  id, mesa_id, veedor_id, assigned_by, reason
)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  m.id,
  '33333333-3333-4333-8333-333333333333'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  'asignacion_inicial'
from public.mesas m
join public.recintos r on r.id = m.recinto_id
where r.code = 'QTO-001' and m.number = '002'
on conflict (id) do nothing;

insert into public.assignments (
  id, mesa_id, veedor_id, assigned_by, reason
)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid,
  m.id,
  '44444444-4444-4444-8444-444444444444'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  'asignacion_inicial'
from public.mesas m
join public.recintos r on r.id = m.recinto_id
where r.code = 'QTO-002' and m.number = '001'
on conflict (id) do nothing;

insert into public.assignments (
  id, mesa_id, veedor_id, assigned_by, active, unassigned_at, reason
)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid,
  m.id,
  '55555555-5555-4555-8555-555555555555'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  false,
  now(),
  'veedor_ausente'
from public.mesas m
join public.recintos r on r.id = m.recinto_id
where r.code = 'QTO-003' and m.number = '001'
on conflict (id) do nothing;

insert into public.assignments (
  id, mesa_id, veedor_id, assigned_by, replaces_assignment_id, reason
)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'::uuid,
  m.id,
  '44444444-4444-4444-8444-444444444444'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid,
  'reemplazo_veedor_ausente'
from public.mesas m
join public.recintos r on r.id = m.recinto_id
where r.code = 'QTO-003' and m.number = '001'
on conflict (id) do nothing;
