# Documento Consolidado de Requerimientos, Supuestos y Decisiones Técnicas (ADR)

**Examen I - Desarrollo de Aplicaciones Móviles**  
**Proyecto:** Control Electoral para Organización Política  
**Plataforma:** React Native / Expo (APK instalable en Android)  
**Arquitectura:** Clean Architecture  

---

## Datos del Equipo

| Dato | Detalle |
| :--- | :--- |
| **Integrante 1** | Jairo Efraín Maigua Aimacaña |
| **Integrante 2** | Oscar Julián Vázquez Borja |
| **Integrante 3** | Milka Elizabeth Borja Quinto |
| **Integrante 4** | Kevin Alexander Amagua Valenzuela |
| **Fecha de la reunión** | 22/11/2026 |
| **Duración de la reunión** | No registrada |
| **Enlace del video** | Pendiente de publicación por el equipo |

---

## 1. Requerimientos Acordados

### 1.1 Requerimientos Funcionales (RF)

| Código | Requerimiento | Necesidad que lo origina |
| :--- | :--- | :--- |
| **RF-01** | El sistema deberá permitir al coordinador provincial crear cuentas para los coordinadores de recinto y a los coordinadores de recinto se les permitirá crear cuentas para los veedores, mediante el registro de sus datos personales y rol correspondientes. Sin embargo, un usuario sin autorización no puede ingresar al sistema. | Sección 3.1 Acceso de los usuarios |
| **RF-02** | El sistema debe exigir que al registrar un usuario se valide su cédula ecuatoriana (dígito verificador y sin errores de digitación), nombres, apellidos, teléfono y correo electrónico. Adicionalmente, todo usuario nuevo debe cambiar su contraseña al ingresar por primera vez para que solo él sea quien conozca su clave definitiva. | Sección 3.1 Acceso de los usuarios |
| **RF-03** | El sistema debe verificar la veracidad del correo del usuario mediante el envío de un enlace de confirmación. | Sección 3.1 Acceso de los usuarios |
| **RF-04** | El sistema deberá permitir a los usuarios con un correo electrónico previamente verificado enviar un enlace de recuperación permitiéndoles establecer una contraseña nueva. | Sección 3.1 Acceso de los usuarios |
| **RF-05** | Datos precargados: recintos de la provincia y el cantón elegidos, 5 organizaciones políticas y sus candidatos por dignidad (Alcaldía y Prefectura). | Sección 3.2 Organización del territorio y del personal |
| **RF-06** | El sistema deberá permitir al coordinador provincial consultar los recintos pertenecientes a su jurisdicción y registrar nuevos recintos dentro de ella. | Sección 3.2 Organización del territorio y del personal |
| **RF-07** | El sistema deberá permitir asignar un único coordinador responsable a cada recinto electoral, garantizando que cada recinto tenga una persona encargada de su administración y evitando asignar simultáneamente dos coordinadores responsables al mismo recinto. | Sección 3.2 Organización del territorio y del personal |
| **RF-08** | El sistema deberá permitir al coordinador de recinto asignar un veedor a cada mesa electoral perteneciente a su recinto, permitiendo que un solo veedor pueda cubrir múltiples mesas sin restricción de cantidad. | Sección 3.2 Organización del territorio y del personal |
| **RF-09** | El sistema permitirá al veedor registrar los resultados de las actas de escrutinio correspondientes a cada una de sus mesas, diferenciando los resultados de Alcaldía y Prefectura. | Sección 3.3 Registro de los resultados |
| **RF-10** | El sistema validará los valores ingresados en cada acta para detectar inconsistencias matemáticas antes de permitir su registro. | Sección 3.3 Registro de los resultados |
| **RF-11** | El sistema permitirá adjuntar una fotografía como evidencia de cada acta de escrutinio registrada, visualizar la fotografía antes de confirmar el registro y advertir cuando no permita distinguir adecuadamente la información del acta. | Sección 3.3 Registro de los resultados |
| **RF-12** | El sistema registrará la ubicación geográfica desde la cual se captura la fotografía de cada acta, con el propósito de comprobar que fue tomada dentro del recinto electoral correspondiente. | Sección 3.3 Registro de los resultados |
| **RF-13** | El sistema permitirá al veedor modificar los resultados de las actas correspondientes a las mesas que tiene asignadas y al coordinador de recinto modificar cualquier acta perteneciente a su recinto. | Sección 3.3 Registro de los resultados |
| **RF-14** | El sistema permitirá al veedor consultar el estado de cada acta durante su procesamiento (`en proceso`, `guardado` localmente / `enviado` al servidor, o `fallado`) y envío. | Sección 3.3 Registro de los resultados |
| **RF-15** | El sistema permitirá al coordinador provincial consultar el avance del registro de resultados (cuántas mesas se reportaron, cuántas faltan por recinto y total), el conteo acumulado de votos por Alcaldía y Prefectura conforme se van ingresando las actas, y la ubicación desde donde se registró cada acta al revisarla. | Sección 3.5 Seguimiento del escrutinio |
| **RF-16** | La aplicación deberá permitir al veedor registrar y editar los resultados de las actas de sus mesas asignadas incluso cuando el dispositivo no disponga de conexión a internet, enviándolos automáticamente al recuperar la conexión. | Sección 3.6 Conectividad el día de la elección |
| **RF-17** | La aplicación deberá detectar y registrar automáticamente los cierres inesperados que ocurran durante su ejecución o errores que no cierren la aplicación pero impidan culminar una tarea. Asimismo, recopilará información técnica del dispositivo y del contexto del error, encolando los reportes generados sin conexión para enviarlos automáticamente al recuperar la red. | Sección 3.7 Estabilidad de la aplicación |
| **RF-18** | Restringir la visualización y edición por rol: cada veedor accede solo a sus mesas asignadas, cada coordinador de recinto solo a su recinto y el coordinador provincial a su jurisdicción. | Sección 3.4 Confidencialidad de la información |
| **RF-19** | Al ingresar o editar un acta, el sistema debe detectar e impedir de inmediato números imposibles (valores negativos, votos de una lista superiores al total de sufragantes o sumas de votos válidos + blancos + nulos distintas al total de sufragantes). | Sección 3.3 Registro de los resultados |
| **RF-20** | El coordinador de recinto debe poder reasignar al instante las mesas de un veedor ausente a otro veedor existente o crear en el momento la cuenta de un veedor sustituto (incluso externo) y asignárselas. | Sección 3.2 Organización del territorio y del personal |

### 1.2 Requerimientos No Funcionales (RNF)

| Código | Requerimiento | Necesidad que lo origina |
| :--- | :--- | :--- |
| **RNF-01** | La aplicación móvil debe desarrollarse en React Native y entregarse como un archivo APK instalable para Android. | Restricciones del proyecto |
| **RNF-02** | La aplicación deberá proteger las credenciales y la información que se transmita mediante herramientas de cifrado y autenticación segura. | Sección 3.1 Acceso de los usuarios / Sección 3.4 Confidencialidad de la información |
| **RNF-03** | La aplicación deberá permitir el registro y la consulta de actas almacenadas localmente sin conexión a internet, y contar con monitoreo de fallos reportando modelo, versión de Android y pantalla afectada. | Sección 3.6 Conectividad / Sección 3.7 Estabilidad de la aplicación |
| **RNF-04** | La aplicación deberá conservar la información de forma local manteniéndola tras cerrar la app o reiniciar el dispositivo, evitando registros duplicados. | Sección 3.3 Registro de resultados / Sección 3.6 Conectividad el día de la elección |
| **RNF-05** | La aplicación deberá desarrollarse mediante una arquitectura mantenible y respetar la línea base de requerimientos y ADR acordada bajo Clean Architecture. | Restricciones del proyecto |
| **RNF-06** | Aplicar los colores de la organización política elegida y brindar retroalimentación visual clara en estados `en proceso`, `guardado`/`enviado`, `falló` y validaciones usando **Lottie** y **Reanimated**, evitando modales genéricos del sistema. | Rúbrica de evaluación |
| **RNF-07** | Flujos de UX simples, claros y tolerantes a errores pensando en veedores y coordinadores mayores o con poca experiencia en el uso de teléfonos móviles. | Sección 3.1 Acceso de los usuarios |
| **RNF-08** | Documentación de decisiones de arquitectura dentro del repositorio antes de instalar dependencias o implementar el código correspondiente. | Rúbrica y autoría del proyecto |

---

## 2. Supuestos Adoptados

| Código | Ambigüedad que resuelve | Supuesto adoptado y justificación |
| :--- | :--- | :--- |
| **S-01** | ¿Quién crea al coordinador provincial? | Se asume que, dado que existe un único coordinador provincial, sus credenciales vienen precargadas en el sistema (`seed`). Es la raíz de la jerarquía y ningún otro rol puede crearlo. |
| **S-02** | Se pide mostrar cuántas mesas han reportado y cuántas faltan, pero no se define cuándo una mesa se considera reportada. | Se asume que una mesa estará completa cuando se hayan registrado y recibido correctamente las dos actas requeridas: Alcaldía y Prefectura. Si solo se recibe una, la mesa se mostrará como parcialmente reportada. |
| **S-03** | Se pide detectar sumas que no cuadran en el momento, pero no se aclara si se deja guardar con advertencia o se bloquea el envío. | Se asume que la validación debe bloquear el guardado. Si un candidato supera el total de sufragantes, hay valores negativos o la suma de votos válidos + blancos + nulos no coincide con el total de sufragantes, no se permite guardar el acta para evitar totales alterados en el conteo rápido en tiempo real. |
| **S-04** | El enunciado exige trabajar sin conexión y posteriormente sincronizar las actas, pero no explica qué sucede si una misma acta se modifica desde distintos dispositivos antes de sincronizarse. | Se asume que cada acta tendrá un número de versión y un registro de modificaciones. Si se detecta que una misma acta fue modificada desde distintos dispositivos antes de sincronizarse, el sistema conserva ambas versiones y notifica al coordinador del recinto para que revise y determine cuál debe prevalecer. |
| **S-05** | Cuando se reemplaza a un veedor ausente no se detalla qué pasa con sus permisos anteriores ni con las actas que ya hubiera subido. | Se asume con el equipo que, al reasignar una mesa, el veedor anterior pierde inmediatamente el acceso a esa mesa para cuidar la confidencialidad, pero cualquier acta que ya estuviera registrada se conserva con su historial de auditoría. |
| **S-06** | El enunciado solicita comprobar que la ubicación de la fotografía corresponda al recinto, pero no define el margen de distancia permitido. | Se asume con el equipo que las coordenadas GPS son obligatorias para guardar (sin GPS activo o sin permiso no se registra el acta), sin bloquear el envío por una geocerca estricta porque en aulas cerradas o zonas rurales el GPS suele variar varios metros. En cambio, en la vista del coordinador se muestra el punto en el mapa junto al recinto y una alerta visual si supera los 300 metros de distancia. |

---

## 3. Registro de Decisiones Técnicas (ADR)

### ADR-01: Uso de Supabase Auth para sistema de autenticación y gestión de credenciales

* **Requerimientos y supuestos relacionados:** `RF-01`, `RF-02`, `RF-03`, `RF-04`, `RNF-02`, `S-01`.
* **Minuto del video:** No registrado
* **Contexto:** La aplicación contempla tres tipos de roles (`Coordinador Provincial`, `Coordinador de Recinto` y `Veedor`), por lo que cada cuenta debe crearse en orden jerárquico y cada usuario debe poder restablecer su contraseña, verificar su correo y recuperar el acceso sin depender de un coordinador o técnico externo. Adicionalmente, en elecciones pasadas se reportaron ingresos de cédulas mal digitadas que impidieron determinar quién reportó ciertas actas, por lo que es indispensable validar el formato y dígito verificador de la cédula ecuatoriana.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **Supabase Auth** | Jairo Maigua | Gestiona contraseñas cifradas, sesiones con tokens, confirmación de correo y recuperación con enlaces únicos. Facilita implementar RLS junto con PostgreSQL. | Dependencia de un proveedor externo. Las reglas de negocio deben implementarse fuera del servicio. |
| **Firebase Authentication** | Oscar Vázquez | SDK compatible con React Native, verificación de correo y recuperación de contraseña integradas. | No contiene RLS nativo; la autorización por recinto debe resolverse con reglas aparte y la creación de cuentas exige SDK Admin en servidor. |
| **Appwrite** | Kevin Amagua y Milka Borja | Integra autenticación, base de datos y almacenamiento con opción *self-hosted* como backend propio. | Exige administrar servidor y disponibilidad; menor soporte de ejemplos con React Native y menos práctico para consultas relacionales comparado con Supabase. |

* **Decisión:** Se elige **Supabase Auth** como servicio externo porque gracias a su sistema de encriptación y manejo de tokens facilita el desarrollo seguro de la app. La creación de cuentas se realiza mediante una API administrativa en servidor de modo que ningún usuario puede registrarse solo. La clave temporal se controla mediante indicadores en metadatos/perfil que la app verifica en el primer ingreso, y se aprovecha RLS para aislar por rol y recinto.
* **Consecuencias:** Se gana seguridad robusta en la gestión de credenciales y tokens con menos código expuesto a errores. El correo integrado por defecto de Supabase tiene limitaciones de cuota, por lo que se requiere configurar un servicio SMTP externo propio y definir correctamente las URLs de redireccionamiento en la APK.

---

### ADR-02: Uso de Supabase + SMTP para creación de cuentas por terceros, servicio de enlaces, verificación de correo y recuperación de clave

* **Requerimientos y supuestos relacionados:** `RF-01`, `RF-03`, `RF-04`, `RNF-02`.
* **Minuto del video:** No registrado
* **Contexto:** Nadie puede registrarse por su cuenta: el coordinador provincial crea las cuentas de los coordinadores de recinto y estos crean las de sus veedores. Como la cuenta la crea otra persona, el titular aún no ha demostrado que el correo es suyo y debe confirmarlo mediante enlace único con expiración antes de habilitar su acceso. Además, la recuperación autónoma de contraseña solo debe habilitarse para correos previamente verificados, evitando llamadas de soporte al coordinador.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **Supabase + SMTP personalizado** | Jairo Maigua | Supabase envía correos de verificación y recuperación sin código extra de generación de tokens; los enlaces son de un solo uso y con expiración. | Plantilla base poco personalizable por defecto; requiere validar que el flujo de correo no entre en conflicto con el cambio de clave temporal. |
| **Firebase Authentication** | Kevin Amagua | Ofrece autenticación, Firestore y Cloud Storage con buena integración en React Native. | Al ser NoSQL hace que las consultas relacionales requeridas en el sistema electoral sean más complejas. |

* **Decisión:** Se elige **Supabase con SMTP personalizado**, disparando la creación de cuentas desde servidor (Edge Function) para no interrumpir la sesión del coordinador activo. El SMTP personalizado permite enviar correos desde el dominio institucional en español, manteniendo las credenciales SMTP exclusivamente en la configuración del servidor y nunca dentro de la app (`RNF-02`).
* **Consecuencias:** Se obtiene un flujo probado de enlaces únicos de verificación y recuperación con identidad de la organización, sin cerrar la sesión del coordinador al registrar personal. Requiere probar los esquemas de deep link en el APK compilado para evitar fallos de redirección o clasificación en SPAM, y considerar que los correos requieren conexión a internet.

---

### ADR-03: Uso de SQLite (`expo-sqlite`) para persistencia local y sincronización offline

* **Requerimientos y supuestos relacionados:** `RF-14`, `RF-16`, `RNF-03`, `RNF-04`, `S-04`.
* **Minuto del video:** No registrado
* **Contexto:** En zonas rurales los veedores se quedan sin conexión justo durante el conteo. Toda acta y fotografía debe guardarse localmente en el dispositivo sin perderse al cerrar la app o reiniciar el teléfono, permitir correcciones mientras no sea enviada y sincronizarse automáticamente al recuperar señal sin generar duplicados por reintentos o cortes intermitentes.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **SQLite local (`expo-sqlite`) con tabla de salida (`outbox`) e identificador de cliente por acta** | Jairo Maigua | Datos relacionales y consultas por estado; persistencia tras cerrar o reiniciar; transacciones atómicas que evitan registros a medias. | Requiere diseñar el esquema SQL y migraciones, y no cuenta con cifrado nativo por defecto. |
| **Cola en AsyncStorage o MMKV (JSON)** | Milka Borja | Implementación rápida y sencilla sin esquema relacional complejo. | Carece de transacciones atómicas; un fallo puede corromper la cola y obliga a recorrer JSON grandes. |
| **WatermelonDB** | Oscar Vázquez | Pensado para escenarios *offline-first* con protocolo de sincronización propio. | Configuración nativa compleja y curva de aprendizaje alta para el plazo de entrega. |
| **Realm Database** | Kevin Amagua | Modelo orientado a objetos que simplifica la manipulación directa en pantalla de corrección. | Añade dependencias nativas adicionales y menor familiaridad del equipo en Expo frente a SQLite. |

* **Decisión:** Se elige **`expo-sqlite`** (en modo WAL) como fuente de verdad local con tabla `outbox` para operaciones pendientes, almacenamiento local de fotografías vinculadas por ruta y control de versiones por acta (`S-04`) para conservar ambas versiones y notificar al coordinador de recinto en caso de edición concurrente offline desde distintos dispositivos.
* **Consecuencias:** Garantiza que ninguna acta se pierda ante cortes de red o reinicios y mantiene control claro de cada estado (`pendiente`, `en_proceso`, `guardado`/`enviado`, `fallado`). Exige gestionar migraciones limpias y validar almacenamiento disponible antes de guardar fotografías.

---

### ADR-04: Uso de `expo-camera` + `expo-location` para captura de fotografía y geolocalización de actas

* **Requerimientos y supuestos relacionados:** `RF-11`, `RF-12`, `RF-15`, `S-06`.
* **Minuto del video:** No registrado
* **Contexto:** En elecciones anteriores se reportaron fotografías borrosas e ilegibles y cuestionamientos sobre actas fotografiadas fuera del recinto electoral. Se requiere captura en vivo dentro de la app, verificación previa de nitidez/legibilidad y captura automática de coordenadas GPS en el momento del registro.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **Cámara en vivo con `expo-camera` y `expo-location`** | Jairo Maigua y Oscar Vázquez | Obliga a tomar la foto dentro de la app impidiendo subir imágenes de galería; permite advertir sobre nitidez con vista previa y capturar GPS en el disparo. | Requiere permisos de cámara y ubicación y calibrar el umbral de nitidez con actas reales. |
| **Selector de imágenes con `expo-image-picker`** | Kevin Amagua y Milka Borja | Implementación más simple delegando a cámara/galería del sistema. | Permite seleccionar fotos antiguas de galería tomadas fuera del recinto y no garantiza GPS en vivo al capturar. |

* **Decisión:** Se elige **`expo-camera`** para captura en vivo con medición/advertencia de nitidez y vista previa obligatoria antes de confirmar, junto con **`expo-location`** tomando lecturas de precisión en el momento de captura (`S-06`), sin bloquear por geocerca estricta pero alertando visualmente al coordinador si la distancia supera los 300 metros respecto al recinto.
* **Consecuencias:** Aumenta la legibilidad y confiabilidad probatoria de las evidencias. Requiere calibrar adecuadamente la advertencia de nitidez para no rechazar fotografías válidas en aulas con poca iluminación.

---

### ADR-05: Uso de Sentry para monitoreo de fallos y reporte de errores

* **Requerimientos y supuestos relacionados:** `RF-17`, `RNF-02`, `RNF-03`.
* **Minuto del video:** No registrado
* **Contexto:** En procesos anteriores los usuarios reportaban cierres repentinos o bloqueos sin poder indicar pantalla, modelo o versión de Android. Se requiere captura automática de *crashes* nativos y errores no fatales que impiden culminar tareas, con soporte offline para enviar reportes al recuperar red.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **Sentry (`@sentry/react-native`)** | Jairo Maigua | Captura errores nativos y JS, rastro de pantallas previas (*breadcrumbs*), modelo de dispositivo y versión Android, guarda eventos offline y permite filtrar datos sensibles. | Requiere build nativo/APK para *crashes* nativos y cuidar el cupo del plan gratuito. |
| **Firebase Crashlytics** | Kevin Amagua | Agrupa fallos nativos en Android e indica usuarios afectados. | Exige configurar Firebase nativamente y ofrece menor flexibilidad para capturar errores funcionales no fatales de flujo JS. |
| **Tabla propia en Supabase** | Oscar Vázquez | Sin dependencia de terceros y consultable vía SQL. | No captura *crashes* nativos si la app muere abruptamente y requiere programar una cola offline propia. |
| **BugSnag** | Milka Borja | Monitoreo móvil con seguimiento de versiones y errores. | Plan gratuito más limitado para el periodo de pruebas que el de Sentry. |

* **Decisión:** Se elige **Sentry (`@sentry/react-native`)** configurando hooks de saneamiento (`beforeSend`) para eliminar cédulas, nombres, teléfonos y correos de todo reporte, manteniendo modelo de dispositivo, versión de Android, pantalla activa y almacenamiento local de fallos sin conexión.
* **Consecuencias:** Permite diagnosticar fallos reales y demostrar un error controlado en la sustentación respetando la confidencialidad de los datos personales (`RNF-02`).

---

### ADR-06: Uso de Expo Router para navegación basada en archivos

* **Requerimientos y supuestos relacionados:** `RF-01`, `RF-02`, `RF-18`, `RNF-05`, `RNF-07`.
* **Minuto del video:** No registrado
* **Contexto:** La aplicación maneja tres perfiles con vistas y permisos distintos (`coordinador provincial`, `coordinador de recinto` y `veedor`), cambio obligatorio de clave en primer ingreso y usuarios con poca experiencia digital que requieren flujos predecibles y manejo correcto del botón atrás en Android.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **Expo Router** | Kevin Amagua | Integrado en Expo sin dependencias extra; organiza grupos de rutas por rol (`auth`, `provincial`, `recinto`, `veedor`) y facilita guardias de redirección por sesión, rol y cambio de clave. | Obliga a mantener `domain/`, `data/` y componentes fuera de `app/` para que no se interpreten como rutas. |
| **React Navigation configurado manualmente** | Kevin Amagua | Control explícito sobre cada stack o tab navigator en TypeScript. | Requiere instalar y configurar manualmente varios paquetes y mantiene la jerarquía de rutas menos visible. |

* **Decisión:** Se elige **Expo Router** organizando grupos de rutas separados por rol y controlando la redirección inicial según tres condiciones: sesión activa, rol del usuario y cumplimiento del cambio obligatorio de clave inicial.
* **Consecuencias:** Mantiene una navegación clara y predecible por perfil, obligando a ubicar toda la arquitectura limpia (`domain/`, `data/` y componentes reutilizables) fuera de la carpeta `app/`.

---

### ADR-07: Manejo de estado y actualización en vivo del conteo rápido en tiempo real

* **Requerimientos y supuestos relacionados:** `RF-14`, `RF-15`, `RF-16`, `RNF-05`.
* **Minuto del video:** No registrado
* **Contexto:** La aplicación gestiona sesión, rol, conectividad, cola offline y el tablero de avance y conteo acumulado para el coordinador provincial, el cual debe actualizarse conforme ingresan las actas sin recargas manuales ni degradación de rendimiento en celulares de gama baja.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **Zustand + TanStack Query + Supabase Realtime** | Milka Borja | Bajo *boilerplate*, estados claros de carga/error e invalidación selectiva en vivo cuando llegan nuevas actas por Realtime sin trabar la UI. | Exige separar claramente qué estado vive en Zustand (sesión/offline) y qué maneja TanStack Query (datos remotos). |
| **Redux Toolkit (RTK + RTK Query)** | Oscar Vázquez | Muy estructurado y predecible. | Demasiado código repetitivo para el plazo de desarrollo individual. |
| **Solo React Context API** | Kevin Amagua | No requiere instalar librerías extra. | Provoca *re-renders* innecesarios en tableros en vivo y obliga a programar caché y reintentos manualmente. |

* **Decisión:** Se elige **Zustand** para el estado de sesión, rol, conectividad y cola offline, combinado con **TanStack Query** conectado a casos de uso de `domain` y suscripciones de **Supabase Realtime** encapsuladas en `data` para refrescar en vivo el avance por recinto y el conteo rápido.
* **Consecuencias:** Mantiene la interfaz ágil en dispositivos de gama media/baja y obliga a encapsular las suscripciones Realtime detrás de los repositorios y cerrarlas al cerrar sesión para preservar Clean Architecture.

---

### ADR-08: Uso de React Hook Form para el manejo de formularios de usuarios, territorio y actas

* **Requerimientos y supuestos relacionados:** `RF-02`, `RF-06`, `RF-08`, `RF-09`, `RF-13`, `RF-20`, `RNF-04`, `RNF-07`, `S-03`.
* **Minuto del video:** No registrado
* **Contexto:** La aplicación contiene múltiples formularios, destacando la transcripción y edición de actas para dos dignidades (Alcaldía y Prefectura), cada una con votos de cinco organizaciones políticas, votos nulos, votos en blanco y total de sufragantes. Muchos veedores tienen poca experiencia con el celular, por lo que el formulario debe ser fluido, precargar datos previos al corregir un acta y bloquear envíos repetidos mientras se procesa.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **React Hook Form** | Kevin Amagua | Minimiza *re-renders* al digitar cifras en celulares de gama baja, permite precargar fácilmente actas en modo edición con `reset()` y expone `isSubmitting` para bloquear dobles envíos. | Requiere envolver componentes de entrada personalizados con `Controller` y suma una dependencia externa. |
| **TanStack Form** | Oscar Vázquez | Ofrece tipado estricto y seguimiento campo por campo en formularios complejos. | Mayor verbosidad para definir cada campo y menos ejemplos directos en React Native para el plazo disponible. |
| **Estado local con `useState` por campo** | Jairo Maigua | No añade dependencias y resulta directo en formularios de dos o tres campos. | Con ocho campos numéricos por dignidad, validaciones cruzadas y modo edición, el código se repite y la pantalla se redibuja en cada pulsación. |

* **Decisión:** Se elige **React Hook Form** para gestionar los formularios de creación de usuarios y recintos, reemplazo de veedores y registro o corrección de actas electorales.
* **Consecuencias:** Mejora la fluidez en dispositivos Android de gama media/baja, estandariza los errores por campo y previene envíos duplicados durante el guardado.

---

### ADR-09: Uso de Zod para validar cédulas, correos y coherencia numérica de actas

* **Requerimientos y supuestos relacionados:** `RF-02`, `RF-10`, `RF-19`, `RNF-02`, `S-02`, `S-03`.
* **Minuto del video:** No registrado
* **Contexto:** En elecciones anteriores se registraron cédulas mal digitadas y actas con cifras imposibles, como candidatos con más votos que el total de sufragantes o sumas inconsistentes. La validación debe ocurrir al instante tanto al registrar como al corregir datos, manteniendo las reglas desacopladas de la UI.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **Zod** | Milka Borja | Permite definir esquemas reutilizables con inferencia TypeScript y reglas cruzadas (`superRefine`) para cédula ecuatoriana, votos, nulos, blancos y total de sufragantes. | Añade una dependencia más y exige mapear los mensajes de error en la interfaz. |
| **Yup** | Jairo Maigua | Valida esquemas de formularios y condiciones entre campos con API madura. | Infiere tipos de TypeScript con menos precisión que Zod y expresa reglas cruzadas complejas con más dificultad. |
| **Validaciones manuales con `if/else`** | Oscar Vázquez | No agrega librerías externas y cada regla queda visible. | Duplica lógica entre creación y edición de actas, aumentando el riesgo de omitir validaciones. |

* **Decisión:** Se elige **Zod** para centralizar los esquemas de validación de identidad y consistencia aritmética de actas en `domain`, ejecutándose antes de guardar o enviar cualquier registro.
* **Consecuencias:** Bloquea de inmediato cédulas inválidas y actas matemáticamente imposibles (`RF-19`, `S-03`) reutilizando las mismas reglas en todos los flujos sin acoplar la lógica de negocio a la UI.

---

### ADR-10: Uso de NetInfo con cola local en SQLite para sincronización automática al recuperar conexión

* **Requerimientos y supuestos relacionados:** `RF-14`, `RF-16`, `RNF-03`, `RNF-04`, `S-04`.
* **Minuto del video:** No registrado
* **Contexto:** Muchos veedores en recintos rurales no tienen señal al finalizar el conteo, y en procesos anteriores las actas se perdieron o se duplicaron por reintentos manuales. La aplicación debe detectar cambios de conectividad, guardar localmente sin red y sincronizar automáticamente actas, fotos y reportes pendientes al recuperar conexión, reflejando siempre su estado real.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **`@react-native-community/netinfo` con cola en SQLite e identificadores únicos por acta** | Kevin Amagua | Detecta pérdida y recuperación de red y dispara el envío ordenado de actas pendientes con identificadores UUID idempotentes que evitan duplicados. | Requiere programar la máquina de estados (`pendiente`, `en_proceso`, `guardado`/`enviado`, `fallado`), reintentos y control de concurrencia. |
| **Sincronización solo manual con botón de reintento** | Jairo Maigua | Evita escuchar eventos de red en segundo plano y simplifica la lógica. | Incumple `RF-16`, porque depende de que el veedor recuerde presionar el botón horas después al salir del recinto rural. |

* **Decisión:** Se elige **`@react-native-community/netinfo`** combinado con una cola transaccional en `expo-sqlite` e identificadores UUID idempotentes por operación/acta para sincronizar automáticamente al detectar conexión y reflejar el estado en vivo.
* **Consecuencias:** Garantiza que ningún acta se pierda por falta de señal y elimina duplicados ante reintentos. Obliga a controlar bloqueos de concurrencia para que dos eventos seguidos de red no procesen simultáneamente el mismo ítem de la cola.

---

### ADR-11: Modelo de datos relacional, roles y aislamiento por recinto (PostgreSQL + RLS)

* **Requerimientos y supuestos relacionados:** `RF-06`, `RF-07`, `RF-08`, `RF-18`, `RF-19`, `RF-20`, `S-02`, `S-03`, `S-05`.
* **Minuto del video:** No registrado
* **Contexto:** El proceso electoral tiene una estructura relacional estricta: un recinto contiene varias mesas, cada mesa tiene un veedor activo y genera dos actas (`Alcaldía` y `Prefectura`), y cada acta reporta votos por organización política. Además, la confidencialidad exige que el aislamiento por rol y jurisdicción no dependa solo de la interfaz móvil, sino que el servidor impida consultas o ediciones no autorizadas y evite actas duplicadas.
* **Alternativas consideradas:**

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
| :--- | :--- | :--- | :--- |
| **PostgreSQL en Supabase con tablas relacionales, Row Level Security (RLS) y restricciones de unicidad** | Jairo Maigua y Milka Borja | Refleja fielmente la estructura territorial; restricción única sobre `(mesa_id, dignidad)` impide duplicados (`RF-16`); RLS filtra cada consulta en servidor según rol y recinto (`RF-18`); Realtime actualiza el conteo en vivo. | Exige diseñar y probar rigurosamente las políticas RLS para no dejar datos expuestos ni bloquear consultas legítimas, y recalcular agregados al corregir actas. |
| **Firestore con documentos anidados** | Kevin Amagua | Escala bien en lecturas en tiempo real con reglas por documento. | Carece de relaciones nativas e integridad referencial; unir recintos, mesas y actas obliga a duplicar datos o encadenar consultas complejas. |
| **Backend propio que valida reglas solo en código sin RLS** | Oscar Vázquez | Permite expresar reglas de negocio en un lenguaje general. | Si la app consulta la base directamente en algún punto la seguridad queda incompleta, y exige mantener un servidor adicional desplegado. |

* **Decisión:** Se elige **PostgreSQL en Supabase** con tablas relacionales (`recintos`, `mesas`, `usuarios`, `asignaciones_veedores`, `actas`, `organizaciones`, `candidatos`, `votos`), restricción única sobre `(mesa_id, dignidad)` y **Row Level Security (RLS)**: el veedor solo lee/edita actas de sus mesas activas, el coordinador de recinto solo las de su recinto y el coordinador provincial tiene lectura sobre su jurisdicción sin modificar actas. Al reemplazar un veedor, su asignación anterior se revoca de inmediato (`S-05`) conservando el historial de auditoría de las actas registradas.
* **Consecuencias:** Garantiza integridad referencial, cero actas duplicadas y aislamiento real en servidor. Exige probar las políticas RLS con cuentas de cada rol antes de la defensa y asegurar que los conteos acumulados recalculen correctamente cuando se edita un acta.

---

## 4. Estado de implementación

- `ADR-01`: Supabase Auth con creación jerárquica desde la Edge Function `create-user`, clave temporal y cambio obligatorio en el primer ingreso.
- `ADR-02`: Invitaciones, confirmación y recuperación con SMTP personalizado y redirección `controlectoraladn://callback`.
- `ADR-03`: Persistencia local en `expo-sqlite`, outbox con UUID idempotente, estados `pendiente`, `en_proceso`, `guardado_local`, `enviado` y `fallado`.
- `ADR-04`: Captura con `expo-camera`, GPS con `expo-location`, vista previa con advertencia de nitidez y ubicación como coordenadas + mapa OpenStreetMap embebido vía WebView, sin depender de API key.
- `ADR-05`: Sentry con saneamiento de datos personales, contexto de dispositivo/pantalla y captura de errores de la cola offline.
- `ADR-06`: Expo Router con grupos por rol y guardias de sesión, rol y cambio de clave.
- `ADR-07`: Sesión y cola en `SessionProvider`; avance y conteo se derivan de las actas devueltas por los repositorios.
- `ADR-08`: Formularios de usuarios, territorio, reemplazo de veedores y actas con React Hook Form.
- `ADR-09`: Esquemas Zod compartidos para cédula ecuatoriana, contacto, claves y cuadre matemático del acta; el total de sufragantes es editable y no se calcula desde los mismos votos validados.
- `ADR-10`: `NetInfo` dispara el vaciado automático de la cola; la foto se sube al bucket privado `actas` antes de registrar el acta y se reintenta sin duplicados.
- `ADR-11`: RLS en Supabase con funciones auxiliares en el esquema privado `private`; las fotos usan políticas en `storage.objects` y URLs firmadas.
