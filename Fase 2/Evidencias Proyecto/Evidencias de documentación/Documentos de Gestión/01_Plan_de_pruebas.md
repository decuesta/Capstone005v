# 01 — Plan de pruebas — E-Match

- **Versión:** 1.1, 29-10-2026 (1.0 ajustada: José Landeros ejecuta todas las pruebas).
- **Punto del orden de trabajo:** 3 (plan de pruebas y matriz de trazabilidad), pieza 1 de 4.
- **Base:** estructura del estándar ISO/IEC/IEEE 29119-3 (documentación de pruebas), simplificada para el tamaño del proyecto.
- **Sistema bajo prueba:** E-Match en producción, https://e-match-jade.vercel.app, commit `aa8ff81` (29-10-2026), con base de datos Supabase.
- **Plazo:** las pruebas cierran el **10-11-2026** (Carta Gantt V3, semana 10). El piloto es en la semana 11.
- **Autor:** Demis Cuesta. **Ejecución de las pruebas:** José Landeros.
- **Decisiones de Demis Cuesta (29-10-2026):** probar sobre la base actual con fecha de corte antes del piloto; incluir pruebas automatizadas (Vitest y Playwright); matriz, casos y registro de resultados en una hoja de cálculo de Google en esta carpeta; José Landeros ejecuta todas las pruebas, porque Demis Cuesta está dedicado a la documentación.

## 1. Objetivo

Comprobar, con evidencia registrada, que E-Match cumple los requisitos funcionales construidos y los no funcionales que se pueden verificar, y dejar trazabilidad entre requisito, historia de usuario, caso de prueba y resultado.

## 2. Alcance

### 2.1 Qué se prueba

| Grupo | Requisitos |
| --- | --- |
| Flujo del emprendedor | RF-01 (wizard), RF-02 (IA con salida JSON), RF-04 (Canvas de 9 bloques y respaldo), RF-05 (editar el Canvas, alcance reducido CA-05), RF-07 (plataforma), RF-08 (fundamento), RF-09 (costo y aviso), RF-10 (transportista y tarifa), RF-11 (ruta de autogestión), RF-25 (ruta "aún no es momento") |
| Agencias | RF-12 (hasta 3 agencias; construido sin motor, en orden aleatorio estable), RF-13 (registrar contacto), RF-24 (aviso de exención), RF-26 (agencias de asesoría en la ruta RF-25) |
| Cuenta y datos | RF-14 (calificar utilidad, CA-06), RF-15 (historial), RF-21 (registro, inicio de sesión y recuperación), RF-22 (consentimiento) |
| Administración | RF-16 (plataformas), RF-17 (pesos y ajustes), RF-18 (tarifas), RF-19 (agencias), RF-20 (KPI), RF-32 (alerta de vigencia) |
| Instalación | RF-23 (PWA) |
| No funcionales | RNF-01 (rendimiento), RNF-02 (respaldo si falla la IA), RNF-03 (autenticación y roles), RNF-04 (OWASP, en conjunto con el punto 4), RNF-05 (Ley 19.628), RNF-06 (usabilidad), RNF-07 (accesibilidad básica), RNF-10 (escritorio y móvil), RNF-13 (puntaje ciego a comisiones), RNF-14 (topes de IA), RNF-16 (vigencia del tarifario) |
| Regresión | Casos que protegen lo ya corregido (CP-REG-01: registro de uso) |

### 2.2 Qué no se prueba, y por qué

| Requisito | Motivo | Cómo se cubre |
| --- | --- | --- |
| RF-03 | Postergado (CA-01) | Se verifica la necesidad de fondo: el diagnóstico sin cuenta se recupera al iniciar sesión |
| RF-06 | Sin objeto (CA-02) | Se verifica que editar el Canvas no cambia la recomendación y que el motor es determinista |
| RF-27 a RF-31 | Fuera del MVP desde la planificación (Could) | No aplica |
| RNF-08, RNF-09, RNF-11, RNF-12, RNF-15 | Son propiedades de diseño, no de comportamiento | **Inspección** de la arquitectura y del modelo de datos (puntos 2 y 4), no ejecución |

## 3. Tipos de prueba

| Tipo | Qué cubre | Herramienta | Quién ejecuta | Evidencia |
| --- | --- | --- | --- | --- |
| **Unitarias (automatizadas)** | Funciones puras: motor de puntaje (pesos, normalización, desempate, ruta RF-25), validación de respuestas del wizard, limpieza de texto del PDF | **Vitest** (nuevo en el repositorio) | José Landeros (`npm test`) | Salida de la ejecución y reporte de cobertura |
| **Integración y seguridad de la base** | Políticas RLS, permisos de funciones y reglas de negocio de la base | Los 8 scripts existentes (`probar-*-rls.mjs`, `probar-funciones-admin.mjs`), formalizados como casos | José Landeros | Salida de cada script |
| **De punta a punta (automatizada)** | Flujo principal: consentimiento → wizard → resultado → plan paso a paso → PDF | **Playwright** (nuevo en el repositorio), contra la URL de producción | José Landeros | Reporte y capturas de Playwright |
| **Funcionales (manuales)** | Criterios de aceptación de cada historia de usuario construida, pantallas de administración | Navegador, consulta SQL de verificación cuando aplique | José Landeros | Registro en la hoja + capturas |
| **Usabilidad** | RNF-06: completar el diagnóstico sin conocimientos técnicos | Tareas guiadas + cuestionario **SUS** (System Usability Scale, 10 preguntas) | José Landeros con 5 participantes | Respuestas SUS, tiempos y observaciones |
| **Rendimiento básico** | RNF-01: recomendación en menos de 5 s sin contar la IA | Tiempos medidos por Playwright contra producción y, como apoyo, los registros de Vercel (los entrega Demis Cuesta, que administra la cuenta) | José Landeros | Tabla de tiempos de 10 diagnósticos |
| **Accesibilidad básica** | RNF-07: contraste, teclado, etiquetas | Lighthouse (Chrome) en las pantallas principales | José Landeros | Reporte de Lighthouse |
| **Compatibilidad** | RNF-10 y RF-23: escritorio y móvil, instalación como PWA | Chrome de escritorio, un Android y un iPhone (si hay disponibles) | José Landeros | Capturas |
| **Seguridad (OWASP)** | RNF-04 y RNF-03 | Lista de verificación OWASP Top 10 aplicada al sistema | José Landeros (la lista se diseña en el punto 4) | Lista con resultado por ítem |

## 4. Entorno de pruebas

- **Producción** (Vercel + Supabase): pruebas funcionales, de usabilidad, de compatibilidad y de seguridad.
- **Equipo de José Landeros:** pruebas unitarias (no necesitan claves) y scripts de la base (usan solo la clave pública de Supabase, nunca la de servicio). La prueba de punta a punta y la de rendimiento se ejecutan **contra la URL de producción**, así que no hace falta copiar claves secretas (de servicio ni de la IA) al equipo de quien prueba.
- **Ojo:** cualquier entorno local de la aplicación usa la misma base de datos que producción.
- **No hay base de datos de pruebas separada** (decisión del 29-10-2026). Se acepta porque todo lo que hay hoy en la base son datos de prueba.
- **Fecha de corte (resuelve la decisión pendiente 12):** el día que empiece el piloto se registra la fecha y hora de corte. Las métricas del piloto se calculan solo con datos posteriores a esa marca. No se borra nada de la base.
- **Cuentas de prueba:** una cuenta de emprendedor y una de administrador, exclusivas para pruebas. Sus correos se anotan en la hoja (sin contraseñas).

## 5. Datos de prueba

Perfiles del wizard que cubren las ramas del motor y de la interfaz:

| Perfil | Respuestas clave | Qué ejercita |
| --- | --- | --- |
| P1 — Vende y crece (productos físicos) | Etapa "vendo y crezco", físicos, presupuesto +$25.000, despacho Nacional | Ruta completa: plataforma, transportista, costo con envío, agencias de desarrollo |
| P2 — Productos frágiles | "Vendo presencial", frágiles, hasta $25.000, Regional | Ajustes de peso por fragilidad y zona |
| P3 — Servicios | Tipo "Servicios" | Sin transportista ni envío; wizard de 5 pasos; aviso de reservas |
| P4 — Aún no vende, sin presupuesto | "Aún no vendo", $0 | Ruta RF-25 (sin plataforma formal) y agencias de asesoría en redes (RF-26); wizard sin pregunta de ventas |
| P5 — Mismo perfil repetido | Mismas respuestas que P1 | Determinismo del motor (CA-02) |

Como referencia de un caso real, P1 puede representar a Encanto de Cera (en lo adelante identificado como ECer), siempre con datos ficticios.

## 6. Criterios

**Para empezar (entrada):**
- Producción en `aa8ff81` o posterior, y el commit anotado en cada ejecución.
- Cuentas de prueba creadas.
- Hoja de pruebas disponible.
- José Landeros con el repositorio clonado, Node.js instalado y un `.env.local` con **solo** las variables públicas de Supabase, más las credenciales de las cuentas de prueba para los scripts de administración.

**Para dar por terminado (salida, al 10-11-2026):**
- 100 % de los casos de requisitos **Must** ejecutados.
- Al menos 90 % de todos los casos ejecutados aprobados.
- Ningún defecto **crítico** ni **alto** abierto. Los medios y bajos pueden quedar abiertos si están registrados con su decisión.
- Pruebas unitarias y de punta a punta ejecutándose sin fallas.
- Puntaje SUS promedio de al menos **68** (valor de referencia habitual de usabilidad aceptable).

**Para suspender:** si producción queda inaccesible o un defecto crítico impide seguir el flujo principal, se suspende la ejecución hasta corregirlo.

## 7. Gestión de defectos

| Severidad | Significado | Ejemplo |
| --- | --- | --- |
| Crítica | Impide usar el flujo principal o expone datos | No se genera el resultado; un usuario ve datos de otro |
| Alta | Un requisito Must no se cumple, con alternativa | El PDF falla con cierto texto |
| Media | Un requisito Should o Could falla, o hay un error con solución sencilla | Un aviso no aparece |
| Baja | Detalle visual o de redacción | Texto cortado |

- Cada defecto se registra en la hoja (código DEF-nn, caso que lo detectó, severidad y estado).
- **Corrección:** igual que PR32 a PR34. Demis Cuesta prepara la corrección y la despliega; José Landeros vuelve a ejecutar el caso y la regresión.
- **Regresión:** después de cada despliegue se ejecutan las pruebas automatizadas y los casos de regresión.

## 8. Roles

| Rol | Persona | Responsabilidad |
| --- | --- | --- |
| Diseño de pruebas | Demis Cuesta | Propone el plan, los casos, la matriz y las pruebas automatizadas |
| Desarrollo y corrección | Demis Cuesta | Incorpora las pruebas automatizadas al repositorio; corrige y despliega los defectos |
| Ejecución y registro | José Landeros | Ejecuta **todas** las pruebas: automatizadas, de la base, funcionales, rendimiento, usabilidad, accesibilidad, compatibilidad y seguridad; registra resultados y defectos |
| Aprobación | Demis Cuesta | Aprueba el cierre de pruebas el 10-11 |

> Confirmado por Demis Cuesta el 29-10-2026: José Landeros asume la ejecución completa de las pruebas porque Demis Cuesta está dedicado de lleno a la documentación. Es coherente con el Plan de Proyecto, que asigna a José Landeros calidad y pruebas.

## 9. Calendario (29-10 al 10-11-2026)

| Fecha | Actividad |
| --- | --- |
| 29 y 30-10 | Plan de pruebas (este documento); matriz de trazabilidad y lista de casos en la hoja |
| 30-10 al 01-11 | Fichas de los casos Must; pruebas automatizadas (Vitest y Playwright) propuestas por Demis Cuesta |
| 01 al 03-11 | Demis Cuesta incorpora las pruebas automatizadas al repositorio (PR35); José Landeros prepara su equipo y ejecuta las pruebas de la base y de rendimiento |
| 02 al 06-11 | Ejecución de casos funcionales, accesibilidad y compatibilidad |
| 04 al 07-11 | Usabilidad con 5 participantes (SUS) |
| 06 al 08-11 | Corrección de defectos y nueva ejecución |
| 09 y 10-11 | Regresión final, informe de resultados y cierre |

## 10. Entregables

| Entregable | Dónde |
| --- | --- |
| Plan de pruebas | `07_Pruebas/01_Plan_de_pruebas.md` (este documento) |
| Matriz de trazabilidad, casos de prueba, registro de ejecución y defectos | Hoja de cálculo de Google `07_Pruebas/02_Matriz_y_casos_de_prueba` |
| Pruebas automatizadas | Repositorio `microeco266/e-match` (carpeta de pruebas, PR35) |
| Informe de resultados | `07_Pruebas/03_Informe_de_resultados.md` (al cierre) |

## 11. Codificación de los casos

| Prefijo | Tipo | Ejemplo |
| --- | --- | --- |
| `CP-RFxx-nn` | Funcional, por requisito | CP-RF05-01 (ya ejecutado) |
| `CP-RNFxx-nn` | No funcional | CP-RNF01-01 (rendimiento) |
| `CP-REG-nn` | Regresión | CP-REG-01 (ya ejecutado) |
| `CP-SEG-nn` | Seguridad (base y OWASP) | CP-SEG-01 (políticas RLS) |
| `CP-USA-nn` | Usabilidad | CP-USA-01 (tarea: completar un diagnóstico) |
| `UT-…` / `E2E-…` | Pruebas automatizadas | UT-MOTOR-01, E2E-FLUJO-01 |

Casos ya ejecutados y aprobados: **CP-REG-01** (28-10), **CP-RF05-01** (28-10) y **CP-RF14-01** (29-10).

## 12. Riesgos de las pruebas

| Riesgo | Mitigación |
| --- | --- |
| Base compartida entre local y producción | Fecha de corte antes del piloto; cuentas de prueba identificadas |
| La IA externa falla o se agota la cuota gratuita | El respaldo con plantilla es justamente lo que prueba RNF-02; los topes (RNF-14) limitan el consumo |
| Poco tiempo (12 días) y una sola persona ejecutando | Prioridad a los Must; pruebas automatizadas acotadas al núcleo; casos manuales agrupados por perfil para ejecutarlos de una vez |
| José Landeros necesita preparar su equipo | Instrucciones paso a paso en la hoja; sin claves secretas (ver sección 4) |
| No conseguir 5 participantes para usabilidad | Mínimo aceptable: 3 participantes, declarado en el informe |
| Cambios en producción durante las pruebas | Anotar el commit en cada ejecución; ejecutar la regresión después de cada despliegue |
