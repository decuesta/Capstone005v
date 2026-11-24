# Pruebas automatizadas de E-Match

Parte del plan de pruebas de la tesis (`07_Pruebas/01_Plan_de_pruebas.md`). Los códigos de caso (UT-…, E2E-…, CP-…) son los de la hoja `02_Matriz_y_casos_de_prueba`, donde se registra cada ejecución.

**Quién las ejecuta:** José Landeros, igual que los scripts `probar-*.mjs` de la raíz (seguridad de la base). Las propone y las incorpora al repositorio Demis Cuesta (decisión del 30-10-2026).

## Preparar el equipo (una sola vez)

1. Node.js 20 o superior.
2. En la raíz del repositorio: `npm ci` (instala exactamente las versiones del `package-lock.json`).
3. Navegador para Playwright: `npx playwright install chromium`.

Las pruebas unitarias no necesitan `.env.local` ni claves. Las de punta a punta corren contra la aplicación publicada y tampoco usan claves.

## Pruebas unitarias (Vitest)

```bash
npm test                 # UT-VALID-01, UT-MOTOR-01 a 04, UT-COSTO-01
npm run test:cobertura   # lo mismo, más el reporte de cobertura (carpeta coverage/)
```

- Usan un catálogo ficticio en memoria (`tests/unit/apoyo/`). No se conectan a Supabase ni a la IA, y no cambian nada.
- Evidencia: captura de la salida de la terminal y de `coverage/index.html`.

## Pruebas de punta a punta (Playwright)

```bash
npm run test:e2e          # E2E-FLUJO-01, 02 y 03
npm run test:rendimiento  # CP-RNF01-01
npx playwright show-report  # abre el reporte con capturas
```

- Corren contra https://e-match-jade.vercel.app. Para otra dirección: `E2E_URL=https://otra.direccion npm run test:e2e`.
- **Crean diagnósticos reales en la base de producción** (antes de la fecha de corte del piloto, así que no cuentan en sus métricas):
  - `test:e2e`: 3 diagnósticos y hasta 3 Canvas de la IA.
  - `test:rendimiento`: unos 15 diagnósticos y hasta 5 Canvas de la IA. Tarda varios minutos.
- **Descarga del PDF:** solo con la cuenta de emprendedor de prueba. Se ejecuta así:

  ```bash
  npm run test:e2e:cuenta
  ```

  Pide el correo y la contraseña en la terminal (la contraseña no se muestra) y se los pasa solo a Playwright. **No escribir la contraseña en la línea de comandos**: queda guardada en el historial de PowerShell. Con la cuenta, la traza de Playwright se apaga y la contraseña se escribe de forma que no aparece en el reporte.

  Con `npm run test:e2e` (sin cuenta), la prueba comprueba que se pida crear una cuenta y deja un aviso en el reporte.
- **Rendimiento (RNF-01):** primero agota el tope de 5 Canvas con IA del navegador de la prueba; desde ahí la aplicación usa la plantilla y no llama a la IA, así que el tiempo medido es el de la aplicación más la red de quien prueba. Deja los tiempos en `test-results/.../rendimiento.csv` y en el reporte. Anotar en la hoja el tipo de conexión usada.
- Evidencia: el reporte de Playwright (carpeta `playwright-report/`) y el `rendimiento.csv`.

## Si algo falla

- Revisar el reporte (`npx playwright show-report`): trae la captura de la prueba fallida (y la traza, si se ejecutó sin cuenta).
- Si el resultado no aparece en 90 segundos, puede ser la IA externa: repetir más tarde antes de registrar un defecto.
- Registrar el defecto en la pestaña Defectos de la hoja, con el caso y la captura.
