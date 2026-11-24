// ============================================================
// app/admin/reglas/utilidades.ts
// Tipos y funciones de apoyo del mantenedor de reglas y pesos del motor
// de scoring (RF-17). Se usan desde page.tsx y los componentes de esta
// carpeta.
// ============================================================

export interface Categoria {
  id: string;
  nombre: string;
}

export interface CriterioFila {
  id: string;
  categoria_id: string;
  nombre: string;
  peso_base: number | string;
}

export interface Regla {
  id: string;
  criteria_id: string;
  condicion: string;
  ajuste_peso: number | string;
}

export interface Opcion {
  id: string;
  categoria_id: string;
  nombre: string;
  activo: boolean;
}

export interface Nota {
  option_id: string;
  criteria_id: string;
  calificacion: number | string;
}

export interface Mensaje {
  texto: string;
  tipo: "ok" | "error";
}

// Rango permitido para el ajuste de una regla (la base lo vuelve a comprobar).
export const AJUSTE_MIN = -20;
export const AJUSTE_MAX = 20;

// Convierte el texto de un campo a número; null si está vacío o no es válido.
export function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// Ajuste con signo explícito: +10, -10, 0.
export function formatoAjuste(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

// Puntaje base (escala 0-100): promedio ponderado de las notas con los
// pesos indicados, igual que el motor pero SIN las reglas de ajuste.
// Devuelve null si no hay notas con peso.
export function puntajeBase(notas: Nota[], pesos: Record<string, number>): number | null {
  let sumaPonderada = 0;
  let sumaPesos = 0;
  for (const n of notas) {
    const peso = pesos[n.criteria_id];
    if (peso === undefined) continue;
    sumaPonderada += Number(n.calificacion) * peso;
    sumaPesos += peso;
  }
  if (sumaPesos <= 0) return null;
  return Math.round((sumaPonderada / sumaPesos) * 20 * 10) / 10;
}

// Texto legible de la condición de una regla ("campo=valor"). Si el
// campo no se conoce, se muestra la condición tal como está guardada.
const CAMPOS: Record<string, string> = {
  etapa_emprendimiento: "la etapa es",
  presupuesto_mensual: "el presupuesto mensual es",
  cantidad_productos: "la cantidad de productos es",
  urgencia_envio: "la urgencia de envío es",
  zona_despacho: "la cobertura de despacho es",
  tipo_producto: "el tipo de producto es",
};

const VALORES: Record<string, Record<string, string>> = {
  etapa_emprendimiento: {
    aun_no_vendo: "Aún no vendo",
    vendo_presencial: "Vendo en persona",
    vendo_y_crezco: "Ya vendo y quiero crecer",
    vendo_y_ordeno: "Ya vendo pero necesito ordenar",
  },
  cantidad_productos: { "1-10": "entre 1 y 10", "11-50": "entre 11 y 50", "+50": "más de 50" },
};

export function textoCondicion(condicion: string): string {
  const i = condicion.indexOf("=");
  if (i === -1) return condicion;
  const campo = condicion.slice(0, i);
  const valor = condicion.slice(i + 1);
  const etiquetaCampo = CAMPOS[campo];
  if (!etiquetaCampo) return condicion;
  return `Si ${etiquetaCampo} ${VALORES[campo]?.[valor] ?? valor}`;
}