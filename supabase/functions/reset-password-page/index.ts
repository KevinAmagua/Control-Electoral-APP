import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function html(body: string) {
  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response('Método no permitido', {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey =
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return html('Falta la configuración pública de Supabase.');
  }

  return html(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Restablecer contraseña | Control Electoral</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f2f5f8; color: #14213d; }
    .card { width: min(92vw, 430px); padding: 28px; border-radius: 18px; background: #fff; box-shadow: 0 12px 40px rgba(20,33,61,.12); }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { margin: 0 0 18px; color: #52606d; line-height: 1.5; }
    label { display: block; font-weight: 700; margin: 14px 0 6px; }
    input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #cbd3dc; border-radius: 10px; font-size: 15px; }
    button { width: 100%; margin-top: 20px; padding: 13px 16px; border: 0; border-radius: 10px; background: #0b5fff; color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; }
    button:disabled { opacity: .6; cursor: default; }
    .message { margin: 16px 0 0; padding: 12px; border-radius: 10px; background: #eef4ff; color: #0b3d91; }
    .error { background: #fff0f0; color: #a4161a; }
    .ok { background: #ecfdf3; color: #027a48; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Restablecer contraseña</h1>
    <p id="intro">Validando el enlace seguro...</p>
    <div id="message" class="message hidden"></div>
    <form id="form" class="hidden">
      <label for="password">Nueva contraseña</label>
      <input id="password" type="password" minlength="8" autocomplete="new-password" required />
      <label for="confirm">Confirmar contraseña</label>
      <input id="confirm" type="password" minlength="8" autocomplete="new-password" required />
      <button id="submit" type="submit">Guardar contraseña</button>
    </form>
  </main>
  <script type="module">
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

    const supabase = createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseKey)});
    const params = new URLSearchParams(location.search);
    const tokenHash = params.get('token_hash');
    const rawType = params.get('type') ?? 'recovery';
    const allowedTypes = ['recovery', 'invite', 'email', 'magiclink', 'signup'];
    const type = allowedTypes.includes(rawType) ? rawType : 'recovery';
    const intro = document.getElementById('intro');
    const form = document.getElementById('form');
    const message = document.getElementById('message');
    const submit = document.getElementById('submit');

    function showMessage(text, kind = '') {
      message.textContent = text;
      message.className = 'message ' + kind;
    }

    function showForm(text) {
      intro.textContent = text;
      form.classList.remove('hidden');
      message.classList.add('hidden');
    }

    async function start() {
      if (!tokenHash) {
        intro.textContent = 'Enlace incompleto';
        showMessage('El enlace no incluye el token de recuperación. Solicite uno nuevo desde la app.', 'error');
        return;
      }

      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        showForm('Escriba la nueva contraseña para su cuenta.');
        return;
      }

      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        intro.textContent = 'No fue posible validar el enlace';
        showMessage('El enlace venció o ya fue usado. Solicite uno nuevo desde la app.', 'error');
        return;
      }

      showForm('Escriba la nueva contraseña para su cuenta.');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm').value;
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        showMessage('La contraseña debe tener al menos 8 caracteres, letras y números.', 'error');
        return;
      }
      if (password !== confirm) {
        showMessage('Las contraseñas no coinciden.', 'error');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Guardando...';
      const { error: updateError } = await supabase.auth.updateUser({ password });
      submit.disabled = false;
      submit.textContent = 'Guardar contraseña';

      if (updateError) {
        const text = updateError.message.toLowerCase();
        if (text.includes('same_password') || text.includes('different from the old password')) {
          showMessage('La contraseña ya está establecida. Puede iniciar sesión con la contraseña que guardó.', 'error');
          return;
        }
        showMessage(updateError.message ?? 'No fue posible guardar la contraseña.', 'error');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Actualizando estado...';
      const { error: flagError } = await supabase.rpc('completar_cambio_clave');
      submit.disabled = false;
      submit.textContent = 'Guardar contraseña';

      if (flagError) {
        showMessage('La contraseña se guardó, pero no se pudo actualizar el estado de la cuenta. Intente iniciar sesión.', 'error');
        return;
      }

      form.classList.add('hidden');
      intro.textContent = 'Contraseña actualizada';
      showMessage('Ya puede iniciar sesión en la app con su nueva contraseña.', 'ok');
    });

    start();
  </script>
</body>
</html>`);
});
