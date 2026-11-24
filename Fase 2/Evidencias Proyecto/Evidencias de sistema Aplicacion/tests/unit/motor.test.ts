// ============================================================
// tests/unit/motor.test.ts
// Pruebas unitarias del motor de recomendación (utils/scoringEngine.ts)
// con un catálogo ficticio en memoria: no se conecta a Supabase.
// Casos de la hoja de pruebas: UT-MOTOR-01 a UT-MOTOR-04.
// Los puntajes esperados se calculan a mano en cada prueba:
//   puntaje = (suma de nota x peso / suma de pesos) x 20, con un decimal.
// ============================================================
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarTablas, consultas, supabaseFalso, tablas } from "./apoyo/supabaseFalso";
import { catalogoBase, P1 } from "./apoyo/catalogo";

vi.mock("../../utils/supabase", () => ({ supabase: supabaseFalso }));

import {
  armarFundamento,
  esServicio,
  recomendarCourier,
  recomendarPlataforma,
  type RespuestasWizard,
} from "../../utils/scoringEngine";

const perfil = (cambios: Partial<RespuestasWizard> = {}): RespuestasWizard => ({ ...P1, ...cambios });
const puntajes = (r: Awaited<ReturnType<typeof recomendarPlataforma>>) =>
  Object.fromEntries(r.opcionesEvaluadas.map((o) => [o.nombre, o.puntaje]));

beforeEach(() => cargarTablas(catalogoBase()));

describe("UT-MOTOR-01: puntaje ponderado y normalización (RF-07, RNF-15)", () => {
  it("calcula el puntaje de cada plataforma activa y elige la mayor", async () => {
    // Pesos 40/30/30. Alfa (5,2,3) = 3,5 -> 70; Beta (3,5,4) = 3,9 -> 78; Gama (2,3,5) = 3,2 -> 64.
    const r = await recomendarPlataforma(perfil());
    expect(r.resultadoTipo).toBe("ganador_unico");
    expect(puntajes(r)).toEqual({ Alfa: 70, Beta: 78, Gama: 64 });
    expect(r.ganador?.nombre).toBe("Beta");
    expect(r.opcionesEvaluadas.map((o) => o.nombre)).toEqual(["Beta", "Alfa", "Gama"]);
  });

  it("no considera las opciones inactivas", async () => {
    const r = await recomendarPlataforma(perfil());
    expect(r.opcionesEvaluadas.some((o) => o.nombre === "Inactiva")).toBe(false);
  });

  it("aplica la regla que coincide con la respuesta y renormaliza los pesos", async () => {
    // Presupuesto $0 (sin "aún no vendo"): costo 30 + 20 = 50. Pesos 40/50/30, suma 120.
    // Alfa 390/120 -> 65; Beta 490/120 -> 81,7; Gama 380/120 -> 63,3.
    const r = await recomendarPlataforma(perfil({ presupuestoMensual: "$0" }));
    expect(puntajes(r)).toEqual({ Alfa: 65, Beta: 81.7, Gama: 63.3 });
  });

  it("corta en cero un peso que queda negativo", async () => {
    // Servicios: logística 30 - 40 = -10 -> 0. Pesos 40/30/0, suma 70.
    // Alfa 260/70 -> 74,3; Beta 270/70 -> 77,1; Gama 170/70 -> 48,6.
    const r = await recomendarPlataforma(perfil({ tipoProducto: "Servicios" }));
    expect(puntajes(r)).toEqual({ Alfa: 74.3, Beta: 77.1, Gama: 48.6 });
  });

  it("ignora una regla cuya condición no coincide", async () => {
    const r = await recomendarPlataforma(perfil({ presupuestoMensual: "hasta $25.000" }));
    expect(puntajes(r)).toEqual({ Alfa: 70, Beta: 78, Gama: 64 });
  });

  it("puntúa los transportistas con el mismo motor y sus reglas", async () => {
    // Pesos 50/50: Uno (5,2) -> 70; Dos (3,5) -> 80.
    const media = await recomendarCourier(perfil());
    expect(puntajes(media)).toEqual({ "Courier Uno": 70, "Courier Dos": 80 });
    // Urgencia alta: tiempo 50 + 30 = 80. Uno 410/130 -> 63,1; Dos 550/130 -> 84,6.
    const alta = await recomendarCourier(perfil({ urgenciaEnvio: "alta" }));
    expect(puntajes(alta)).toEqual({ "Courier Uno": 63.1, "Courier Dos": 84.6 });
    expect(alta.ganador?.nombre).toBe("Courier Dos");
  });

  it("explica la recomendación con los criterios de buena nota y más peso (RF-08)", async () => {
    const r = await recomendarPlataforma(perfil());
    expect(r.ganador?.criteriosDestacados.map((c) => c.nombre)).toEqual([
      "Costo total de operación",
      "Compatibilidad logística",
    ]);
    expect(armarFundamento("Beta", r.ganador!.criteriosDestacados)).toBe(
      "Las tendencias de tu emprendimiento indican que es una opción económica para tu presupuesto y se ajusta bien a tu forma de despachar, por lo cual sugerimos Beta."
    );
  });

  it("no usa como fundamento un criterio con peso cero", async () => {
    // En servicios la logística pesa 0: Beta solo se explica por el costo.
    const r = await recomendarPlataforma(perfil({ tipoProducto: "Servicios" }));
    expect(r.ganador?.criteriosDestacados.map((c) => c.nombre)).toEqual(["Costo total de operación"]);
    expect(armarFundamento("Beta", [])).toBe(
      "Según los datos de tu diagnóstico, Beta obtuvo el mejor puntaje general para tu perfil."
    );
  });

  it("reconoce el tipo Servicios", () => {
    expect(esServicio({ tipoProducto: "Servicios" })).toBe(true);
    expect(esServicio({ tipoProducto: "Productos Físicos" })).toBe(false);
  });
});

describe("UT-MOTOR-02: desempate (RF-07)", () => {
  const conOpciones = (opciones: { id: string; nombre: string; notas: [number, number, number] }[]) => {
    tablas.scoring_option = opciones.map((o) => ({
      id: o.id, categoria_id: "cat-plat", nombre: o.nombre, enlace_afiliado: null, es_afiliado: false, activo: true,
    }));
    tablas.scoring_option_rating = opciones.flatMap((o) =>
      (["c-fac", "c-cos", "c-log"] as const).map((c, i) => ({ option_id: o.id, criteria_id: c, calificacion: o.notas[i] }))
    );
  };

  it("ante empate gana la mejor nota en Facilidad de uso", async () => {
    // X (4,3,3) = 340 y Y (1,5,5) = 340: empatan en 68.
    conOpciones([
      { id: "y", nombre: "Y", notas: [1, 5, 5] },
      { id: "x", nombre: "X", notas: [4, 3, 3] },
    ]);
    const r = await recomendarPlataforma(perfil());
    expect(puntajes(r)).toEqual({ X: 68, Y: 68 });
    expect(r.ganador?.nombre).toBe("X");
  });

  it("si también empatan en facilidad, gana la mejor nota de costo", async () => {
    // X (4,3,3) = 340 y Z (4,2,4) = 340: misma facilidad, X tiene mejor costo.
    conOpciones([
      { id: "z", nombre: "Z", notas: [4, 2, 4] },
      { id: "x", nombre: "X", notas: [4, 3, 3] },
    ]);
    const r = await recomendarPlataforma(perfil());
    expect(r.ganador?.nombre).toBe("X");
  });

  it("si todo empata, decide el nombre en orden alfabético del español", async () => {
    conOpciones([
      { id: "b", nombre: "Bote", notas: [4, 3, 3] },
      { id: "a", nombre: "Árbol", notas: [4, 3, 3] },
    ]);
    const r = await recomendarPlataforma(perfil());
    expect(r.opcionesEvaluadas.map((o) => o.nombre)).toEqual(["Árbol", "Bote"]);
  });

  it("entrega siempre el mismo resultado con los mismos datos (CA-02)", async () => {
    const a = await recomendarPlataforma(perfil());
    const b = await recomendarPlataforma(perfil());
    expect(b).toEqual(a);
  });
});

describe("UT-MOTOR-03: ruta \"aún no es momento\" (RF-25)", () => {
  it("con \"aún no vendo\" y presupuesto $0 no recomienda plataforma ni consulta la base", async () => {
    const r = await recomendarPlataforma(perfil({ etapaEmprendimiento: "aun_no_vendo", presupuestoMensual: "$0" }));
    expect(r.resultadoTipo).toBe("sin_recomendacion");
    expect(r.ganador).toBeNull();
    expect(r.motivoSinRecomendacion).toMatch(/WhatsApp Business o Instagram Shopping/);
    expect(consultas).toEqual([]);
  });

  it("con \"aún no vendo\" y algo de presupuesto sí recomienda", async () => {
    const r = await recomendarPlataforma(perfil({ etapaEmprendimiento: "aun_no_vendo", presupuestoMensual: "hasta $25.000" }));
    expect(r.resultadoTipo).toBe("ganador_unico");
    expect(r.ganador).not.toBeNull();
  });

  it("con presupuesto $0 pero ya vendiendo sí recomienda", async () => {
    const r = await recomendarPlataforma(perfil({ etapaEmprendimiento: "vendo_presencial", presupuestoMensual: "$0" }));
    expect(r.resultadoTipo).toBe("ganador_unico");
  });
});

describe("UT-MOTOR-04: el puntaje no usa la comisión de afiliado (RNF-13)", () => {
  it("cambiar \"es afiliado\" y el enlace de todas las opciones no cambia puntajes ni orden", async () => {
    const antes = await recomendarPlataforma(perfil());
    tablas.scoring_option = tablas.scoring_option.map((o) => ({
      ...o,
      es_afiliado: !o.es_afiliado,
      enlace_afiliado: o.enlace_afiliado ? null : "https://afiliado.example/ref",
    }));
    const despues = await recomendarPlataforma(perfil());
    expect(puntajes(despues)).toEqual(puntajes(antes));
    expect(despues.opcionesEvaluadas.map((o) => o.nombre)).toEqual(antes.opcionesEvaluadas.map((o) => o.nombre));
  });

  it("el dato de afiliado solo se copia al resultado, para mostrar el botón y el aviso", async () => {
    const r = await recomendarPlataforma(perfil());
    expect(r.ganador).toMatchObject({ nombre: "Beta", esAfiliado: true, enlaceAfiliado: "https://beta.example/ref" });
  });
});
