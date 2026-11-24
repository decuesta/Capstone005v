// ============================================================
// playwright.config.ts
// Configuración de las pruebas de punta a punta (tests/e2e).
// Corren contra la aplicación publicada; para otra dirección se usa la
// variable E2E_URL. Una prueba a la vez, porque comparten la base de
// producción y el tope de uso de la IA.
// ============================================================
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 3 * 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.E2E_URL ?? "https://e-match-jade.vercel.app",
    locale: "es-CL",
    timezoneId: "America/Santiago",
    acceptDownloads: true,
    screenshot: "only-on-failure",
    // La traza guarda los valores que recibe cada paso; con la cuenta de
    // prueba se apaga para que la contraseña no quede en ningún archivo.
    trace: process.env.E2E_CLAVE ? "off" : "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
