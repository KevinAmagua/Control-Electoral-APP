# RNF-02 y RNF-08 — alcance verificable

## RNF-08 — Documentación y cronología de decisiones

- El documento consolidado de requerimientos, supuestos y ADR aprobados está en `docs/adr/ADR-SUPUESTOS-REQUERIMIENTOS.md`.
- Reunión registrada: 22/11/2026.
- Duración: no registrada.
- Enlace del video: pendiente de publicación por el equipo.
- No existe en el repositorio un acta firmada ni un video de la reunión que permita verificar la duración o el enlace; por eso esos datos se conservan como **no verificables** y no se reescribe el historial del ADR.
- Las decisiones posteriores que ajustan la implementación se registran en este apéndice cronológico, sin modificar los acuerdos aprobados.

### Apéndice cronológico de implementación

1. Auditoría del estado remoto y local contra los RF, supuestos y ADR.
2. Corrección del seed y de la creación de cuentas: jerarquía, SMTP, invitación y confirmación de correo.
3. Reestructuración del rol de recinto y del crash de arranque de `expo-sqlite`.
4. endurecimiento de RLS, permisos de escritura de actas y cambio de contraseña mediante la migración `20261125000000_harden_actas_roles.sql`.
5. ADR-07: estado global con Zustand, consultas con TanStack Query y actualizaciones en tiempo real encapsuladas en repositorios.
6. RF-16/RF-14/S-04: caché local, cola de sincronización, estados canónicos y detección/notificación de conflictos por edición concurrente.
7. S-06/RF-11: GPS automático, bloqueo por falta de permiso/GPS y alerta de nitidez no bloqueante.
8. RF-20/RF-13: creación de veedor sustituto con reemplazo inmediato y corrección de actas desde el recinto.
9. RF-02: validación de cédula, nombres, apellidos, teléfono y correo en cliente y Edge Function.
10. RF-07: `create-user` ya no asigna `recinto_id` al coordinador durante la creación; la asignación ocurre al desactivar al coordinador anterior y el índice único evita duplicados activos por recinto.
11. Reset Password: página estática `reset-password.html` preparada para GitHub Pages. Supabase reescribe HTML a `text/plain` en el dominio del proyecto, así que el enlace del correo apunta a GitHub Pages; la página usa solo Supabase Auth con la clave pública y llama `completar_cambio_clave` para conservar RF-02/ADR-01. No modifica los ADR aprobados.
12. RF-02/RF-07: `create-user` version 14 corrige los coeficientes de validación de cédula a 9 dígitos y el alcance de `listUsers`; el despliegue anterior usaba 10 coeficientes y rechazaba cédulas válidas.
13. RF-06: el seed incorpora un segundo coordinador provincial (`coordinador.guayas@adn.ec`, Guayas/Guayaquil) y dos recintos con sus mesas para verificar aislamiento por jurisdicción.
14. RNF-02: todas las cuentas demo fueron restablecidas a la clave temporal `Adn2026!` con bcrypt cost 10 y se cerraron las sesiones activas; se verificó `HTTP 200` en `/auth/v1/token?grant_type=password` para cuentas Gmail y `@adn.ec`.
15. S-06/RF-11: la nitidez se mide ahora sobre una miniatura JPEG normalizada con `expo-image-manipulator`, de modo que una foto borrosa no alcance 100/100; los formularios desplazan el campo enfocado por encima del teclado y la evidencia muestra dirección, coordenadas y radio del recinto junto a la distancia.
16. RF-07: la creación o asignación de un coordinador de recinto ya ocupado se rechaza con `COORDINADOR_YA_ASIGNADO` en la pantalla provincial, el caso de uso y `create-user` v15; se conserva al coordinador activo en lugar de reemplazarlo. Esta decisión sustituye el comportamiento descrito en el punto 10.
17. RF-16/RF-17: la sesión y los datos de referencia se restauran desde caché local sin red; la cola usa un único `start`, reintenta cada 15 s y drena al reconectar; las actas falladas pueden reeditarse en el mismo `operationId`; Sentry conserva hasta 60 envelopes locales, hace `flush` al reconectar y captura errores de pantalla mediante un `ErrorBoundary`.
18. RF-18/RF-19/RF-20: la caché de referencia se separa por `auth.uid()` para evitar fugas entre cuentas sin red; `mesas_update` excluye veedores y `assignments_select` solo expone asignaciones activas al veedor mediante `20261125070000_harden_rf18_policies.sql`; la corrección de actas usa `actaFormSchema` en `onChange` y bloquea el guardado con `validateActaDraft`; `reemplazar_veedor` valida las asignaciones previas antes de crear una cuenta sustituta.

## RNF-02 — Seguridad de credenciales y transferencia

- Las comunicaciones cliente/servidor usan HTTPS mediante el endpoint Supabase del proyecto.
- La autenticación usa Supabase Auth con JWT; las sesiones se mantienen en el cliente y los tokens se envían solo al backend.
- Las credenciales SMTP y la service role key permanecen exclusivamente en la configuración de Supabase y se usan desde Edge Functions.
- La app no incluye secretos de servicio; `.env.example` solo referencia variables públicas `EXPO_PUBLIC_*`.
- RLS restringe lectura y escritura por rol. Las escrituras de actas pasan por `public.registrar_acta` y verifican `private.can_write_mesa`.
- Las RPC `security definer` necesarias para la app (`registrar_acta`, `asignar_veedor`, `reemplazar_veedor`) son ejecutables por `authenticated` y validan rol/jurisdicción internamente; el acceso de `anon` fue revocado.
- Las Edge Functions verifican JWT y jerarquía antes de crear cuentas.
- `create-user` valida cédula ecuatoriana, nombres, apellidos, teléfono ecuatoriano obligatorio y correo; rechaza un segundo coordinador activo para el mismo recinto; crea la cuenta por invitación y exige cambio de contraseña al primer ingreso.
- La base de datos registra `password_changed_at` y bloquea el flujo de cambio de contraseña si la contraseña no fue actualizada.
- Los reportes de error de Sentry se envían sin secretos ni claves.
- Limitación conocida: `expo-sqlite` no cifra la información local en reposo. El cifrado local exigiría una decisión nueva (nuevo ADR) y una dependencia nativa adicional.
- Configuración pendiente en Dashboard de Supabase: activar “Leaked Password Protection”, confirmar la plantilla Invite y las redirect URLs. No se puede activar desde el código del repositorio.
