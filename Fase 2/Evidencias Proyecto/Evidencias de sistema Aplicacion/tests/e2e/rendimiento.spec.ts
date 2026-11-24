// ============================================================
// tests/e2e/rendimiento.spec.ts
// Caso de la hoja de pruebas: CP-RNF01-01 (RNF-01): la recomendación
// debe llegar en menos de 5 segundos, sin contar la IA.
// Cómo se excluye la IA: en un navegador nuevo se hacen diagnósticos
// hasta alcanzar el tope de 5 Canvas con IA por navegador (RNF-14).
// Desde ahí la aplicación usa la plantilla de respaldo y no llama a la
// IA, así que el tiempo medido es el de la aplicación (motor, costo y
// guardado) más la red de quien prueba.
// Uso: hasta 5 Canvas de la IA y unos 15 diagnósticos en la base.
// Deja los tiempos en test-results (rendimiento.csv) y en el reporte.
// ============================================================
import { expect, test } from "@playwright/test";
import { empezar, esperarResultado, hacerDiagnostico, PERFILES } from "./apoyo";

const MEDICIONES = 10;
const LIMITE_MS = 5_000;
const TOPE_IA = 5; // TOPE_IA_PERSONA_DIA por defecto en app/actions/generateCanvas.ts
const MAX_PREVIOS = 12; // diagnósticos para llegar al tope, como máximo

test.setTimeout(20 * 60_000);

test("CP-RNF01-01: tiempo de la recomendación sin la IA", async ({ page }) => {
  const respaldo = page.getByText("Generado con plantilla de respaldo");

  // 1) Llegar al tope de la IA en este navegador: 5 Canvas redactados por la IA.
  //    Un Canvas de respaldo antes de eso es una falla de la IA y no cuenta.
  let previos = 0;
  let conIA = 0;
  for (;;) {
    await empezar(page, false);
    await hacerDiagnostico(page, PERFILES.P1);
    await esperarResultado(page);
    previos++;
    const usoRespaldo = await respaldo.isVisible();
    if (!usoRespaldo) conIA++;
    if (usoRespaldo && conIA >= TOPE_IA) break;
    expect(previos, "no se alcanzó el tope de la IA").toBeLessThan(MAX_PREVIOS);
  }

  // 2) Medir 10 diagnósticos que ya no llaman a la IA.
  const tiempos: number[] = [];
  for (let i = 1; i <= MEDICIONES; i++) {
    await empezar(page, false);
    const inicio = await hacerDiagnostico(page, PERFILES.P1);
    await esperarResultado(page, 30_000);
    const ms = Date.now() - inicio;
    await expect(respaldo, `la medición ${i} llamó a la IA`).toBeVisible();
    tiempos.push(ms);
  }

  const promedio = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length);
  const csv = ["medicion,milisegundos", ...tiempos.map((t, i) => `${i + 1},${t}`), `promedio,${promedio}`].join("\n");
  const { writeFile } = await import("node:fs/promises");
  const ruta = test.info().outputPath("rendimiento.csv");
  await writeFile(ruta, csv);
  await test.info().attach("rendimiento.csv", { path: ruta, contentType: "text/csv" });
  test.info().annotations.push({
    type: "tiempos",
    description: `Diagnósticos previos para llegar al tope: ${previos} (${conIA} con IA). Tiempos (ms): ${tiempos.join(", ")}. Promedio: ${promedio} ms.`,
  });

  for (const [i, t] of tiempos.entries()) {
    expect.soft(t, `medición ${i + 1}`).toBeLessThan(LIMITE_MS);
  }
});
