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
   ```

4. Configurar SMTP personalizado en Supabase → Auth → SMTP Settings y ajustar las plantillas de invitación, confirmación y recuperación en español usando el enlace de redirección de la APK.

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
