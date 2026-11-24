// ============================================================
// tests/e2e/apoyo.ts
// Funciones comunes de las pruebas de punta a punta: perfiles del
// wizard (los mismos P1 a P5 del plan de pruebas), inicio de sesión
// opcional y recorrido consentimiento -> wizard -> resultado.
// Las opciones se eligen por el texto que se ve en pantalla.
// ============================================================
import { expect, type Page } from "@playwright/test";

export type Perfil = {
  tipo: RegExp;
  etapa: RegExp;
  presupuesto: RegExp;
  ventas?: RegExp;
  cobertura?: RegExp;
  urgencia?: RegExp;
  cantidad: RegExp;
};

export const PERFILES: Record<"P1" | "P3" | "P4", Perfil> = {
  P1: {
    tipo: /Productos Físicos/,
    etapa: /Ya vendo y quiero crecer/,
    presupuesto: /Más de \$25\.000/,
    ventas: /Entre \$684\.000 y \$1\.890\.000/,
    cobertura: /Todo Chile/,
    urgencia: /Rapidez media/,
    cantidad: /Entre 11 y 50/,
  },
  P3: {
    tipo: /Servicios \(/,
    etapa: /Vendo en persona/,
    presupuesto: /Hasta \$25\.000/,
    ventas: /Hasta \$200\.000/,
    cantidad: /Entre 1 y 10/,
  },
  P4: {
    tipo: /Productos Físicos/,
    etapa: /Aún no vendo/,
    presupuesto: /\$0 \(Busco alternativas/,
    cobertura: /Local \(Solo en mi ciudad/,
    urgencia: /Sin apuro/,
    cantidad: /Entre 1 y 10/,
  },
};

// Credenciales de la cuenta de emprendedor de prueba, solo desde variables
// de entorno de la terminal (nunca escritas en archivos).
export const cuenta = {
  correo: process.env.E2E_CORREO ?? "",
  clave: process.env.E2E_CLAVE ?? "",
};
export const hayCuenta = () => cuenta.correo !== "" && cuenta.clave !== "";

// Abre el inicio y, si hay cuenta de prueba, inicia sesión antes del diagnóstico.
export async function empezar(page: Page, conCuenta: boolean) {
  await page.goto("/");
  if (conCuenta) {
    await page.getByRole("button", { name: "¿Ya tienes cuenta? Iniciar sesión" }).click();
    await page.getByPlaceholder("tu@correo.cl").fill(cuenta.correo);
    // La contraseña se escribe con evaluate y no con fill: fill deja el
    // valor escrito en los pasos del reporte de Playwright.
    await page.getByPlaceholder("Contraseña").evaluate((campo, clave) => {
      const input = campo as HTMLInputElement;
      const asignar = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      asignar.call(input, clave);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, cuenta.clave);
    await page.locator("form").getByRole("button", { name: "Iniciar sesión" }).click();
    await page.getByRole("button", { name: "Hacer un nuevo diagnóstico" }).click();
  } else {
    await page.getByRole("button", { name: "Iniciar Estudio" }).click();
  }
}

// Acepta el consentimiento y responde el wizard. Devuelve el momento en que
// se eligió la última respuesta (para medir el tiempo hasta el resultado).
export async function hacerDiagnostico(page: Page, perfil: Perfil): Promise<number> {
  await expect(page.getByRole("heading", { name: "Antes de empezar" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Aceptar y continuar" }).click();

  const respuestas = [perfil.tipo, perfil.etapa, perfil.presupuesto, perfil.ventas, perfil.cobertura, perfil.urgencia]
    .filter((r): r is RegExp => r !== undefined);
  for (const r of respuestas) {
    await page.getByRole("button", { name: r }).click();
  }
  const inicio = Date.now();
  await page.getByRole("button", { name: perfil.cantidad }).click();
  return inicio;
}

// Espera la pantalla de resultado (incluye el tiempo de la IA).
export async function esperarResultado(page: Page, timeout = 90_000) {
  await expect(page.getByRole("heading", { name: "Tu Business Model Canvas" })).toBeVisible({ timeout });
}
