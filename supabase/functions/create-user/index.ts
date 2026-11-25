import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CONFIRM_EMAIL_REDIRECT_URL =
  Deno.env.get('CONFIRM_EMAIL_REDIRECT_URL') ?? 'controlectoraladn://confirmar-correo';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;
const PHONE_PATTERN = /^(?:0\d{9}|\+593\d{9})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CEDULA_COEFFICIENTS = [2, 1, 2, 1, 2, 1, 2, 1, 2] as const;

function normalizeCedula(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

type Role = 'coordinador_provincial' | 'coordinador_recinto' | 'veedor';

type CreateUserBody = {
  role: Role;
  cedula: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  recintoId: string | null;
  jurisdiction?: { province: string; canton: string };
  createdBy: string;
  redirectTo?: string;
};

type ProfileRow = {
  id: string;
  role: Role;
  cedula: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  email_verified: boolean;
  must_change_password: boolean;
  recinto_id: string | null;
  province: string | null;
  canton: string | null;
  active: boolean;
};

type ValidationError = { code: string; message: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorJson(code: string, message: string, status = 400) {
  return json({ error: code, message }, status);
}

function isRole(value: unknown): value is Role {
  return (
    value === 'coordinador_provincial' ||
    value === 'coordinador_recinto' ||
    value === 'veedor'
  );
}

function isValidCedula(value: string): boolean {
  const cedula = normalizeCedula(value);
  if (!/^\d{10}$/.test(cedula)) {
    return false;
  }
  const province = Number(cedula.slice(0, 2));
  const isValidProvince = (province >= 1 && province <= 24) || province === 30;
  if (!isValidProvince || Number(cedula[2]) > 5) {
    return false;
  }
  let sum = 0;
  for (let index = 0; index < CEDULA_COEFFICIENTS.length; index += 1) {
    const product = Number(cedula[index]) * CEDULA_COEFFICIENTS[index];
    sum += product >= 10 ? product - 9 : product;
  }
  const remainder = sum % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;
  return checkDigit === Number(cedula[9]);
}

function isAllowedRedirectTo(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) {
    return false;
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'controlectoraladn:' || url.protocol === 'exp:' || url.protocol === 'exps:') {
      return true;
    }
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        /^192\.168\./.test(url.hostname) ||
        /^10\./.test(url.hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname))
    );
  } catch {
    return false;
  }
}

function resolveRedirectTo(value: string | undefined): string {
  return isAllowedRedirectTo(value) ? value : CONFIRM_EMAIL_REDIRECT_URL;
}

function validateBody(body: CreateUserBody | null): ValidationError | null {
  if (!body) {
    return { code: 'SOLICITUD_INVALIDA', message: 'Cuerpo de solicitud inválido' };
  }
  if (!isRole(body.role)) {
    return { code: 'ROL_INVALIDO', message: 'Rol inválido' };
  }
  if (typeof body.cedula !== 'string' || !isValidCedula(body.cedula)) {
    const rawCedula = typeof body.cedula === 'string' ? normalizeCedula(body.cedula) : '';
    let expectedDigit: number | null = null;
    if (/^\d{10}$/.test(rawCedula)) {
      const sum = CEDULA_COEFFICIENTS.reduce((total, coefficient, index) => {
        const product = Number(rawCedula[index]) * coefficient;
        return total + (product >= 10 ? product - 9 : product);
      }, 0);
      const remainder = sum % 10;
      expectedDigit = remainder === 0 ? 0 : 10 - remainder;
    }
    console.warn(
      `CEDULA_INVALIDA length=${rawCedula.length} province=${rawCedula.slice(0, 2)} third=${rawCedula[2] ?? '-'} provided=${rawCedula[9] ?? '-'} expected=${expectedDigit ?? '-'}`,
    );
    return { code: 'CEDULA_INVALIDA', message: 'Cédula ecuatoriana inválida' };
  }
  if (
    typeof body.firstName !== 'string' ||
    body.firstName.trim().length < 2 ||
    !NAME_PATTERN.test(body.firstName.trim())
  ) {
    return {
      code: 'NOMBRE_INVALIDO',
      message: 'El nombre debe tener al menos 2 caracteres y solo letras, espacios, apóstrofos o guiones',
    };
  }
  if (
    typeof body.lastName !== 'string' ||
    body.lastName.trim().length < 2 ||
    !NAME_PATTERN.test(body.lastName.trim())
  ) {
    return {
      code: 'APELLIDO_INVALIDO',
      message: 'El apellido debe tener al menos 2 caracteres y solo letras, espacios, apóstrofos o guiones',
    };
  }
  if (typeof body.phone !== 'string' || !PHONE_PATTERN.test(body.phone.trim())) {
    return { code: 'TELEFONO_INVALIDO', message: 'Teléfono ecuatoriano inválido' };
  }
  if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
    return { code: 'CORREO_INVALIDO', message: 'Correo electrónico inválido' };
  }
  if (typeof body.createdBy !== 'string' || body.createdBy.trim().length === 0) {
    return { code: 'CREADOR_INVALIDO', message: 'Usuario creador inválido' };
  }
  if (body.redirectTo !== undefined && !isAllowedRedirectTo(body.redirectTo)) {
    return { code: 'REDIRECT_INVALIDO', message: 'La URL de retorno no es válida' };
  }
  if (body.role === 'veedor') {
    if (typeof body.recintoId !== 'string' || !UUID_PATTERN.test(body.recintoId)) {
      return { code: 'RECINTO_REQUERIDO', message: 'Indique el recinto del veedor' };
    }
    return null;
  }
  if (body.role === 'coordinador_recinto') {
    const province = body.jurisdiction?.province?.trim();
    const canton = body.jurisdiction?.canton?.trim();
    if (!province || !canton) {
      return {
        code: 'JURISDICCION_REQUERIDA',
        message: 'Indique la provincia y el cantón del coordinador',
      };
    }
    if (typeof body.recintoId !== 'string' || !UUID_PATTERN.test(body.recintoId)) {
      return {
        code: 'RECINTO_REQUERIDO',
        message: 'Seleccione el recinto que asignará al coordinador',
      };
    }
  }
  return null;
}

function temporaryPassword(): string {
  const token = crypto.randomUUID().replace(/-/g, '');
  return `Adn-${token.slice(0, 10)}!`;
}

async function findAuthUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }
    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) {
      return { id: match.id };
    }
    if (users.length < perPage) {
      return null;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorJson('METODO_NO_PERMITIDO', 'Método no permitido', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return errorJson('CONFIGURACION_INVALIDA', 'Configuración del servidor inválida', 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return errorJson('NO_AUTORIZADO', 'No tiene permiso para realizar esta operación', 401);
  }
  const token = authorization.slice('Bearer '.length);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: actorData, error: actorError } = await adminClient.auth.getUser(token);
  if (actorError || !actorData.user) {
    return errorJson('NO_AUTORIZADO', 'No tiene permiso para realizar esta operación', 401);
  }

  let body: CreateUserBody | null = null;
  try {
    body = (await req.json()) as CreateUserBody;
  } catch {
    body = null;
  }
  if (body) {
    if (typeof body.cedula === 'string') {
      body.cedula = normalizeCedula(body.cedula);
    }
    if (typeof body.email === 'string') {
      body.email = body.email.trim().toLowerCase();
    }
  }

  const validationError = validateBody(body);
  if (validationError || !body) {
    const failure = validationError ?? {
      code: 'SOLICITUD_INVALIDA',
      message: 'Cuerpo de solicitud inválido',
    };
    return errorJson(failure.code, failure.message);
  }

  const { data: actorProfile, error: actorProfileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', actorData.user.id)
    .maybeSingle();
  if (actorProfileError || !actorProfile) {
    return errorJson('PERFIL_NO_ENCONTRADO', 'No se encontró el perfil del usuario', 403);
  }
  const actor = actorProfile as ProfileRow;
  if (!actor.active || body.createdBy.trim() !== actor.id) {
    return errorJson('NO_AUTORIZADO', 'No tiene permiso para realizar esta operación', 403);
  }
  if (!actor.email_verified) {
    return errorJson(
      'CORREO_NO_VERIFICADO',
      'Debe verificar su correo electrónico antes de continuar',
      403,
    );
  }

  const cedula = normalizeCedula(body.cedula);
  const email = body.email.trim().toLowerCase();
  const duplicates = [
    {
      column: 'email',
      value: email,
      code: 'CORREO_YA_REGISTRADO',
      message: 'Ya existe una cuenta con ese correo',
    },
    {
      column: 'cedula',
      value: cedula,
      code: 'CEDULA_YA_REGISTRADA',
      message: 'Ya existe una cuenta con esa cédula',
    },
  ] as const;

  for (const duplicate of duplicates) {
    const { data: existing, error: lookupError } = await adminClient
      .from('profiles')
      .select('id')
      .eq(duplicate.column, duplicate.value)
      .maybeSingle();
    if (lookupError) {
      return errorJson('ERROR_CONSULTAR_USUARIO', 'No fue posible validar el usuario', 500);
    }
    if (existing) {
      return errorJson(duplicate.code, duplicate.message, 409);
    }
  }

  let province: string | null = null;
  let canton: string | null = null;
  if (actor.role === 'coordinador_provincial' && body.role === 'coordinador_recinto') {
    if (
      body.jurisdiction?.province?.trim() !== actor.province ||
      body.jurisdiction?.canton?.trim() !== actor.canton
    ) {
      return errorJson('FUERA_DE_JURISDICCION', 'El coordinador está fuera de su jurisdicción', 403);
    }
    province = actor.province;
    canton = actor.canton;
  } else if (actor.role === 'coordinador_recinto' && body.role === 'veedor') {
    if (body.recintoId !== actor.recinto_id) {
      return errorJson('FUERA_DE_JURISDICCION', 'Solo puede crear veedores de su recinto', 403);
    }
    const { data: recinto, error: recintoError } = await adminClient
      .from('recintos')
      .select('province, canton')
      .eq('id', body.recintoId)
      .maybeSingle();
    if (recintoError || !recinto) {
      return errorJson('RECINTO_NO_ENCONTRADO', 'No se encontró el recinto indicado', 404);
    }
    province = recinto.province;
    canton = recinto.canton;
  } else {
    return errorJson('JERARQUIA_INVALIDA', 'Su rol no puede crear este tipo de cuenta', 403);
  }

  if (body.role === 'coordinador_recinto') {
    const { data: assignedCoordinator, error: assignedError } = await adminClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('recinto_id', body.recintoId)
      .eq('role', 'coordinador_recinto')
      .eq('active', true)
      .maybeSingle();
    if (assignedError) {
      return errorJson('ERROR_CONSULTAR_RECINTO', 'No fue posible consultar el recinto', 500);
    }
    if (assignedCoordinator) {
      return errorJson(
        'COORDINADOR_YA_ASIGNADO',
        `Ya hay un coordinador asignado a este recinto: ${assignedCoordinator.first_name} ${assignedCoordinator.last_name}. No se puede crear ni asignar otro.`,
        409,
      );
    }
  }

  const password = temporaryPassword();
  const userMetadata = {
    first_name: body.firstName.trim(),
    last_name: body.lastName.trim(),
    cedula,
    role: body.role,
  };

  try {
    const existingAuthUser = await findAuthUserByEmail(adminClient, email);
    if (existingAuthUser) {
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', existingAuthUser.id)
        .maybeSingle();
      if (existingProfile) {
        return errorJson('CORREO_YA_REGISTRADO', 'Ya existe una cuenta con ese correo', 409);
      }
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(existingAuthUser.id);
      if (cleanupError) {
        return errorJson(
          'ERROR_LIMPIAR_USUARIO',
          'No fue posible preparar la cuenta para la invitación',
          500,
        );
      }
    }
  } catch (error) {
    console.error('No fue posible buscar el usuario por correo', error);
    return errorJson('ERROR_CONSULTAR_USUARIO', 'No fue posible validar el usuario', 500);
  }

  const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: resolveRedirectTo(body.redirectTo),
      data: userMetadata,
    },
  );
  if (inviteError || !invitedUser.user) {
    if (inviteError) {
      console.error('No fue posible invitar al usuario', inviteError);
    }
    const message = inviteError?.message?.toLowerCase() ?? '';
    const status = (inviteError as { status?: number } | null)?.status;
    const rateLimited =
      status === 429 ||
      inviteError?.code === 'over_email_send_rate_limit' ||
      message.includes('rate limit') ||
      message.includes('too many requests');
    const duplicated =
      inviteError?.code === 'email_exists' ||
      message.includes('already been registered') ||
      message.includes('already registered');
    const smtpFailure =
      message.includes('535') ||
      message.includes('username and password not accepted') ||
      message.includes('unexpected_failure') ||
      (status === 500 && message.includes('unexpected failure'));
    if (rateLimited) {
      return errorJson(
        'LIMITE_CORREOS',
        'Se alcanzó el límite de correos por hora. Intente más tarde',
        429,
      );
    }
    if (smtpFailure) {
      return errorJson(
        'ERROR_SMTP',
        'El servidor de correo no está configurado correctamente. Revise SMTP en Supabase.',
        500,
      );
    }
    return duplicated
      ? errorJson('CORREO_YA_REGISTRADO', 'Ya existe una cuenta con ese correo', 409)
      : errorJson('ERROR_INVITAR_USUARIO', 'No fue posible enviar la invitación', 400);
  }

  const { error: passwordError } = await adminClient.auth.admin.updateUserById(
    invitedUser.user.id,
    { password },
  );
  if (passwordError) {
    console.error('No fue posible asignar la contraseña temporal', passwordError);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: invitedUser.user.id,
      role: body.role,
      cedula,
      first_name: body.firstName.trim(),
      last_name: body.lastName.trim(),
      phone: body.phone.trim(),
      email,
      email_verified: false,
      must_change_password: true,
      recinto_id: body.role === 'veedor' ? body.recintoId : null,
      province,
      canton,
      active: true,
    })
    .select('*')
    .single();

  if (profileError || !profile) {
    return errorJson('ERROR_CREAR_PERFIL', 'No fue posible crear el perfil del usuario', 500);
  }

  return json(
    {
      profile,
      temporaryPassword: passwordError ? null : password,
      invitationSent: true,
    },
    201,
  );
});
