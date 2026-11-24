// ============================================================
// tests/unit/costo.test.ts
// Pruebas unitarias del costo mensual estimado
// (calcularCostoEstimado en utils/scoringEngine.ts), con un catálogo
// ficticio en memoria: no se conecta a Supabase.
// Caso de la hoja de pruebas: UT-COSTO-01 (RF-09, RNF-16).
// ============================================================
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarTablas, supabaseFalso, tablas } from "./apoyo/supabaseFalso";
import { catalogoBase } from "./apoyo/catalogo";

vi.mock("../../utils/supabase", () => ({ supabase: supabaseFalso }));

import { calcularCostoEstimado } from "../../utils/scoringEngine";

beforeEach(() => cargarTablas(catalogoBase()));

describe("UT-COSTO-01: cálculo del costo estimado (RF-09, RNF-16)", () => {
  it("suma plan vigente, comisión sobre el monto de referencia y envío de referencia", async () => {
    // Plan más reciente de Beta: 19.990 y 2 %. Tramo 684mil-1890mil: referencia 1.000.000 -> comisión 20.000.
    // Envío: la tarifa Misma_Zona de 3 kg más barata de Courier Uno es 3.900 (12-10-2026).
    const c = await calcularCostoEstimado("p-beta", "t-uno", "684mil-1890mil");
    expect(c).toEqual({
      plan: "Básico",
      precioPlan: 19990,
      comisionEstimada: 20000,
      costoEnvio: 3900,
      totalEstimado: 43890,
      fechaVigenciaTarifa: "2026-10-12",
      esEstimacionMinima: false,
    });
  });

  it("para servicios (sin transportista) no suma envío y usa la vigencia del plan", async () => {
    const c = await calcularCostoEstimado("p-beta", null, "684mil-1890mil");
    expect(c.costoEnvio).toBeNull();
    expect(c.totalEstimado).toBe(19990 + 20000);
    expect(c.fechaVigenciaTarifa).toBe("2026-09-01");
  });

  it("marca como estimación mínima el tramo abierto de ventas", async () => {
    const c = await calcularCostoEstimado("p-beta", "t-uno", "+1890mil");
    expect(c.comisionEstimada).toBe(37800);
    expect(c.esEstimacionMinima).toBe(true);
  });

  it("redondea la comisión a pesos enteros", async () => {
    tablas.planes_plataforma = [
      { plataforma_option_id: "p-beta", nombre_plan: "Básico", precio_mensual_clp: 0, comision_transaccion_pct: 1.55, fecha_vigencia: "2026-09-01" },
    ];
    // 100.000 x 1,55 % = 1.550
    const c = await calcularCostoEstimado("p-beta", null, "0-200mil");
    expect(c.comisionEstimada).toBe(1550);
    expect(Number.isInteger(c.totalEstimado)).toBe(true);
  });

  it("falla con un mensaje claro si la plataforma no tiene plan", async () => {
    await expect(calcularCostoEstimado("p-alfa", null, "0-200mil")).rejects.toThrow(/plan de la plataforma/);
  });

  it("falla con un mensaje claro si el transportista no tiene tarifa de referencia", async () => {
    await expect(calcularCostoEstimado("p-beta", "t-dos", "0-200mil")).rejects.toThrow(/tarifa de envío/);
  });
});
