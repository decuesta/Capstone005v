// ============================================================
// tests/e2e/flujo.spec.ts
// Pruebas de punta a punta contra la aplicación publicada
// (por defecto https://e-match-jade.vercel.app; otra con E2E_URL).
// Casos de la hoja de pruebas: E2E-FLUJO-01, E2E-FLUJO-02 y E2E-FLUJO-03.
// Cada ejecución crea 3 diagnósticos en la base y usa hasta 3 Canvas de la
// IA. Con la cuenta de emprendedor de prueba (npm run test:e2e:cuenta) además
// descarga el PDF con un Canvas editado que incluye un emoji y un salto de
// línea (comprueba la limpieza del texto del PDF de RF-05).
// ============================================================
import { expect, test, type Page } from "@playwright/test";
import { empezar, esperarResultado, hacerDiagnostico, hayCuenta, PERFILES } from "./apoyo";

// Descarga el PDF y comprueba que el archivo sea un PDF con contenido.
async function descargarPDF(page: Page) {
  const espera = page.waitForEvent("download");
  await page.getByRole("button", { name: "📄 Descargar PDF" }).click();
  const descarga = await espera;
  const ruta = test.info().outputPath("diagnostico.pdf");
  await descarga.saveAs(ruta);
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(ruta);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2_000);
  await test.info().attach("diagnostico.pdf", { path: ruta, contentType: "application/pdf" });
}

// Sin cuenta, el PDF pide crear una cuenta (incentivo, no error).
async function comprobarPDFoAviso(page: Page) {
  if (hayCuenta()) {
    await descargarPDF(page);
  } else {
    await expect(page.getByRole("button", { name: "🔒 Crea tu cuenta para descargar tu PDF" })).toBeVisible();
    test.info().annotations.push({ type: "aviso", description: "Sin E2E_CORREO/E2E_CLAVE: no se descargó el PDF." });
  }
}

async function irAlPlanYVolver(page: Page) {
  await page.getByRole("button", { name: "Inicia y escala paso a paso" }).click();
  await expect(page.getByRole("heading", { name: "Plan paso a paso" })).toBeVisible();
  await page.getByRole("button", { name: "← Volver al resultado" }).click();
  await expect(page.getByRole("heading", { name: "Tu Business Model Canvas" })).toBeVisible();
}

test("E2E-FLUJO-01: flujo completo de productos (P1)", async ({ page }) => {
  await empezar(page, hayCuenta());
  await hacerDiagnostico(page, PERFILES.P1);
  await esperarResultado(page);

  await expect(page.getByRole("heading", { name: "Plataforma: mejor ajuste para tu perfil" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Transportista: mejor ajuste para tu perfil" })).toBeVisible();
  await expect(page.getByText(/Puntaje de ajuste: \d+(\.\d)?\/100/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Costo mensual estimado" })).toBeVisible();
  await expect(page.getByText(/Envío \(referencia 3 kg\)/)).toBeVisible();
  await expect(page.getByText(/Tarifario vigente al .+\. Estimación referencial, no vinculante\./)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("resultado-P1.png"), fullPage: true });

  await irAlPlanYVolver(page);

  if (hayCuenta()) {
    // Edita un bloque con un emoji y un salto de línea: antes de PR33 esto hacía fallar el PDF.
    await page.getByRole("button", { name: "✏️ Editar mi Canvas" }).click();
    const bloque = page.locator("textarea").first();
    await bloque.fill("Vendemos velas artesanales 🕯️\nen ferias y por Instagram.");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText(/Editado por ti\./)).toBeVisible();
  }
  await comprobarPDFoAviso(page);
});

test("E2E-FLUJO-02: flujo completo de servicios (P3)", async ({ page }) => {
  await empezar(page, hayCuenta());
  await hacerDiagnostico(page, PERFILES.P3);
  await esperarResultado(page);

  await expect(page.getByRole("heading", { name: "Plataforma: mejor ajuste para tu perfil" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Transportista: mejor ajuste para tu perfil" })).toHaveCount(0);
  await expect(page.getByText(/Envío \(referencia 3 kg\)/)).toHaveCount(0);
  await expect(page.getByText(/Precios vigente al .+\. Estimación referencial, no vinculante\./)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("resultado-P3.png"), fullPage: true });

  await irAlPlanYVolver(page);
  await comprobarPDFoAviso(page);
});

test("E2E-FLUJO-03: ruta \"aún no es momento\" (P4)", async ({ page }) => {
  await empezar(page, hayCuenta());
  await hacerDiagnostico(page, PERFILES.P4);
  await esperarResultado(page);

  await expect(page.getByRole("heading", { name: "Aún no es momento de una plataforma formal" })).toBeVisible();
  await expect(page.getByText("Te sugerimos partir con WhatsApp Business o Instagram Shopping.")).toBeVisible();
  await expect(page.getByRole("link", { name: /crear mi cuenta/ })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("resultado-P4.png"), fullPage: true });

  await irAlPlanYVolver(page);
  await comprobarPDFoAviso(page);
});
