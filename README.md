# Control Electoral ADN

Aplicación móvil Expo/React Native para coordinadores y veedores electorales. Usa Supabase para autenticación, datos, Storage y RLS, con captura de actas offline-first.

## Requisitos

- Node.js y npm
- Expo SDK 58
- Proyecto de Supabase con `supabase/schema.sql` aplicado
- SMTP personalizado configurado en Supabase Auth
- Cuenta de EAS para builds/OTA
- Google Maps API key para el mapa nativo de Android

## Configuración

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env.local` y completar:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   EXPO_PUBLIC_AUTH_REDIRECT_URL=controlectoraladn://callback
   EXPO_PUBLIC_SENTRY_DSN=
   EXPO_PUBLIC_SENTRY_ORG=
   EXPO_PUBLIC_SENTRY_PROJECT=
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
   ```

3. En Supabase → Auth → URL Configuration → Redirect URLs, agregar:

   ```text
   controlectoraladn://callback
   controlectoraladn://confirmar-correo
   exp://**
   ```

   `exp://**` cubre el host dinámico de Expo Go (IP LAN o `127.0.0.1`) y la ruta `/--/callback` o `/--/confirmar-correo` que calcula `Linking.createURL()`. Las variables `EXPO_PUBLIC_*_REDIRECT_URL` quedan solo como fallback para development builds.

4. Publicar `reset-password.html` en GitHub Pages:

   1. Hacer commit y push de `reset-password.html` a la rama `main`.
   2. En GitHub → Settings → Pages → Build and deployment, elegir Source `Deploy from a branch`, Branch `main` y carpeta `/ (root)`.
   3. Guardar y esperar a que el sitio responda en `https://kevinamagua.github.io/Control-Electoral-APP/reset-password.html` (sin parámetros debe mostrar “Enlace incompleto”, no 404).
   4. Configurar SMTP personalizado en Supabase → Auth → SMTP Settings.
   5. En Auth → Templates → Reset Password usar esta plantilla para evitar la redirección a la app:

   ```html
   <h2>Restablecer contraseña</h2>
   <p>Recibimos una solicitud para restablecer la contraseña de su cuenta.</p>
   <p><a href="https://kevinamagua.github.io/Control-Electoral-APP/reset-password.html?token_hash={{ .TokenHash }}&type=recovery">Cambiar contraseña</a></p>
   <p>Si no solicitó este cambio, ignore este correo.</p>
   ```

   La página pública consume el token con Supabase Auth, guarda la nueva clave y llama `completar_cambio_clave`; no depende del Site URL ni de `redirect_to`. Supabase reescribe HTML a `text/plain` en el dominio del proyecto, por eso la página vive en GitHub Pages. Las plantillas de invitación y confirmación sí pueden seguir usando `{{ .ConfirmationURL }}` o `{{ .RedirectTo }}`.

5. Habilitar protección contra contraseñas filtradas en Supabase → Auth → Providers → Email.

6. El esquema crea el bucket privado `actas` y sus políticas en `storage.objects`. La app sube cada foto como `<userId>/<actaId>.jpg` y la visualiza mediante URLs firmadas.

7. Iniciar la app:

   ```bash
   npx expo start
   ```

> `expo-maps` solo funciona en Android e iOS y requiere un development build o APK/EAS build. La vista web muestra coordenadas como respaldo.

## Comandos

```bash
npx expo lint
npx tsc --noEmit
npx expo-doctor
npx expo install --fix
npx expo run:android
eas build --platform android
eas update
```

## Estructura

- `app/`: pantallas y navegación Expo Router.
- `src/domain/`: entidades, repositorios, esquemas Zod y casos de uso puros.
- `src/data/`: implementaciones Supabase, Storage, outbox, contenedor y Sentry.
- `src/presentation/`: providers, componentes y pantallas compartidas.
- `supabase/`: esquema, datos semilla y Edge Functions.
- `docs/adr/`: requerimientos RF/RNF/S, supuestos y decisiones arquitectónicas.

## Flujo de autenticación

- El coordinador provincial crea coordinadores de recinto; el coordinador de recinto crea y reasigna veedores.
- Todas las cuentas demo, incluidas `jonyalexander2003@gmail.com` y `alexade2003v@gmail.com`, usan la clave temporal `Adn2026!` y deben cambiarla en el primer acceso.
- Para probar RF-06 existe un segundo coordinador provincial en el seed: `coordinador.guayas@adn.ec` (Guayas/Guayaquil); los recintos `GYE-001` y `GYE-002` permiten verificar el aislamiento entre jurisdicciones.
- La creación de cuentas se hace desde la Edge Function `create-user`; la clave temporal se entrega en la respuesta y el correo de invitación lo envía Supabase con SMTP propio.
- El primer acceso con clave temporal obliga a cambiarla en `app/(auth)/cambiar-clave.tsx` o `app/(auth)/restablecer-clave.tsx`, según el enlace recibido.
- El acceso exige correo verificado; la sesión se mantiene con `SessionProvider` y el deep link se procesa en `app/(auth)/callback.tsx`.

## Formularios y validación

- Los formularios usan React Hook Form con `zodResolver` y validación `onChange`.
- El total de sufragantes se digita desde el acta física; la app bloquea negatives, candidatos por encima del total y sumas que no cuadran con votos válidos, blancos y nulos.
- Los estados visuales usan Lottie y Reanimated: `en proceso`, `guardado local`, `enviado`, `fallado` y validaciones.

## Seguridad

- RLS por provincia/cantón, recinto y mesa.
- Funciones auxiliares de autorización viven en el esquema privado `private`, no expuesto por PostgREST.
- `public.completar_cambio_clave()` es un wrapper inócuo que delega en `private.completar_cambio_clave()`.
- El bucket `actas` es privado; los coordinadores acceden a las fotos solo mediante URLs firmadas autorizadas por RLS.
- Sentry elimina cédulas, nombres, teléfonos, correos, claves y tokens antes de enviar eventos.

## Estado y documentación

Ver `docs/adr/ADR-SUPUESTOS-REQUERIMIENTOS.md` para el detalle de requerimientos, supuestos, decisiones y configuración manual pendiente.
