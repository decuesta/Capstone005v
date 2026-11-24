// ============================================================
// tests/unit/apoyo/catalogo.ts
// Catálogo ficticio para las pruebas unitarias del motor. Los nombres
// de categorías y criterios son los mismos que usa la base real
// (el motor los busca por nombre); las opciones, notas, pesos, planes
// y tarifas son inventados para que los resultados se puedan calcular
// a mano en cada prueba.
// ============================================================

export const CAT_PLATAFORMAS = "cat-plat";
export const CAT_COURIERS = "cat-cour";

// Respuestas base: perfil P1 del plan de pruebas.
export const P1 = {
  etapaEmprendimiento: "vendo_y_crezco",
  tipoProducto: "Productos Físicos",
  cantidadProductos: "11-50",
  presupuestoMensual: "+$25.000",
  zonaDespacho: "Nacional",
  urgenciaEnvio: "media",
  volumenMensual: "684mil-1890mil",
} as const;

export function catalogoBase() {
  return {
    scoring_category: [
      { id: CAT_PLATAFORMAS, nombre: "Plataformas E-Commerce" },
      { id: CAT_COURIERS, nombre: "Couriers y Logística" },
    ],
    scoring_criteria: [
      // Plataformas: pesos base 40 / 30 / 30 (suman 100).
      { id: "c-fac", categoria_id: CAT_PLATAFORMAS, nombre: "Facilidad de uso", peso_base: 40 },
      { id: "c-cos", categoria_id: CAT_PLATAFORMAS, nombre: "Costo total de operación", peso_base: 30 },
      { id: "c-log", categoria_id: CAT_PLATAFORMAS, nombre: "Compatibilidad logística", peso_base: 30 },
      // Transportistas: pesos base 50 / 50.
      { id: "k-cos", categoria_id: CAT_COURIERS, nombre: "Costo del envío", peso_base: 50 },
      { id: "k-tie", categoria_id: CAT_COURIERS, nombre: "Tiempo de entrega", peso_base: 50 },
    ],
    scoring_weight_rule: [
      // Presupuesto $0: el costo pesa 20 puntos más.
      { criteria_id: "c-cos", condicion: "presupuesto_mensual=$0", ajuste_peso: 20 },
      // Servicios: la compatibilidad logística baja 40 (queda en negativo y se corta a 0).
      { criteria_id: "c-log", condicion: "tipo_producto=Servicios", ajuste_peso: -40 },
      // Urgencia alta: el tiempo de entrega pesa 30 puntos más.
      { criteria_id: "k-tie", condicion: "urgencia_envio=alta", ajuste_peso: 30 },
    ],
    scoring_option: [
      { id: "p-alfa", categoria_id: CAT_PLATAFORMAS, nombre: "Alfa", enlace_afiliado: null, es_afiliado: false, activo: true },
      { id: "p-beta", categoria_id: CAT_PLATAFORMAS, nombre: "Beta", enlace_afiliado: "https://beta.example/ref", es_afiliado: true, activo: true },
      { id: "p-gama", categoria_id: CAT_PLATAFORMAS, nombre: "Gama", enlace_afiliado: null, es_afiliado: false, activo: true },
      { id: "p-inac", categoria_id: CAT_PLATAFORMAS, nombre: "Inactiva", enlace_afiliado: null, es_afiliado: false, activo: false },
      { id: "t-uno", categoria_id: CAT_COURIERS, nombre: "Courier Uno", enlace_afiliado: null, es_afiliado: false, activo: true },
      { id: "t-dos", categoria_id: CAT_COURIERS, nombre: "Courier Dos", enlace_afiliado: null, es_afiliado: false, activo: true },
    ],
    scoring_option_rating: [
      // Alfa: 5 / 2 / 3
      { option_id: "p-alfa", criteria_id: "c-fac", calificacion: 5 },
      { option_id: "p-alfa", criteria_id: "c-cos", calificacion: 2 },
      { option_id: "p-alfa", criteria_id: "c-log", calificacion: 3 },
      // Beta: 3 / 5 / 4
      { option_id: "p-beta", criteria_id: "c-fac", calificacion: 3 },
      { option_id: "p-beta", criteria_id: "c-cos", calificacion: 5 },
      { option_id: "p-beta", criteria_id: "c-log", calificacion: 4 },
      // Gama: 2 / 3 / 5
      { option_id: "p-gama", criteria_id: "c-fac", calificacion: 2 },
      { option_id: "p-gama", criteria_id: "c-cos", calificacion: 3 },
      { option_id: "p-gama", criteria_id: "c-log", calificacion: 5 },
      // Inactiva: notas perfectas, pero no debe considerarse.
      { option_id: "p-inac", criteria_id: "c-fac", calificacion: 5 },
      { option_id: "p-inac", criteria_id: "c-cos", calificacion: 5 },
      { option_id: "p-inac", criteria_id: "c-log", calificacion: 5 },
      // Courier Uno: barato y lento. Courier Dos: caro y rápido.
      { option_id: "t-uno", criteria_id: "k-cos", calificacion: 5 },
      { option_id: "t-uno", criteria_id: "k-tie", calificacion: 2 },
      { option_id: "t-dos", criteria_id: "k-cos", calificacion: 3 },
      { option_id: "t-dos", criteria_id: "k-tie", calificacion: 5 },
    ],
    planes_plataforma: [
      // Dos planes de Beta: el motor debe usar el de fecha más reciente.
      { plataforma_option_id: "p-beta", nombre_plan: "Antiguo", precio_mensual_clp: 9990, comision_transaccion_pct: 3, fecha_vigencia: "2026-01-01" },
      { plataforma_option_id: "p-beta", nombre_plan: "Básico", precio_mensual_clp: 19990, comision_transaccion_pct: 2, fecha_vigencia: "2026-09-01" },
    ],
    rango_volumen_ventas: [
      { codigo: "0-200mil", monto_referencia_clp: 100000 },
      { codigo: "684mil-1890mil", monto_referencia_clp: 1000000 },
      { codigo: "+1890mil", monto_referencia_clp: 1890000 },
    ],
    tarifas_transporte: [
      // Tarifas "Misma_Zona" de 3 kg de Courier Uno: el motor toma la más barata.
      { courier_option_id: "t-uno", zona_destino: "Misma_Zona", quiebre_peso: "S_3kg", tarifa: 4500, fecha_vigencia: "2026-10-10" },
      { courier_option_id: "t-uno", zona_destino: "Misma_Zona", quiebre_peso: "M_3kg", tarifa: 3900, fecha_vigencia: "2026-10-12" },
      // Otro peso y otra zona: no deben usarse.
      { courier_option_id: "t-uno", zona_destino: "Misma_Zona", quiebre_peso: "S_1kg", tarifa: 1000, fecha_vigencia: "2026-10-12" },
      { courier_option_id: "t-uno", zona_destino: "Otra_Zona", quiebre_peso: "S_3kg", tarifa: 500, fecha_vigencia: "2026-10-12" },
    ],
  };
}
