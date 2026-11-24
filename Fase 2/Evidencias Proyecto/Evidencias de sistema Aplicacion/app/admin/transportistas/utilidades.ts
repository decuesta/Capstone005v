// ============================================================
// app/admin/transportistas/utilidades.ts
// Tipos y funciones de apoyo del mantenedor de transportistas (RF-18).
// Se usan desde page.tsx y desde los componentes de esta carpeta.
// Algunas funciones también existen en app/admin/page.tsx (mantenedor
// de plataformas); se pueden unificar después del MVP.
// ============================================================

export interface Courier {
  id: string;
  nombre: string;
  activo: boolean;
  enlace_afiliado: string | null;
  es_afiliado: boolean;
}

export interface Tarifa {
  id: string;
  courier_option_id: string;
  servicio: string;
  zona_origen: string;
  zona_destino: string;
  quiebre_peso: string;
  tarifa: number | string;
  fecha_vigencia: string;
}

export interface Criterio {
  id: string;
  nombre: string;
  peso_base: number | string;
}

// Fila de scoring_option_rating con su criterio embebido (puede llegar
// como objeto o como lista de un elemento).
export interface FilaNota {
  option_id: string;
  calificacion: number | string;
  scoring_criteria: Criterio | Criterio[] | null;
}

export interface NotaCriterio {
  optionId: string;
  criterioId: string;
  nombre: string;
  peso: number;
  nota: number;
}

export interface Mensaje {
  texto: string;
  tipo: "ok" | "error";
}

// Tarifas de un servicio y origen, ordenadas como tabla: destinos en
// filas y tramos de peso en columnas.
export interface GrupoTarifas {
  clave: string;
  servicio: string;
  origen: string;
  zonas: string[];
  tramos: string[];
  celdas: Map<string, Tarifa>;
}

// Una fecha de vigencia de más de estos días se marca "Revisar". Es solo
// una marca visual: no es una alerta (RF-32 sigue postergado).
export const DIAS_REVISAR = 90;

const ORDEN_ZONAS = ["Misma_Zona", "Centro", "Extremo_Norte", "Extremo_Austral"];

// Fecha de hoy (hora local) en formato AAAA-MM-DD.
export function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Fecha AAAA-MM-DD en formato chileno.
export function fechaCL(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL");
}

// Comprueba que el texto sea una fecha AAAA-MM-DD real (no 2026-02-31).
export function fechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d;
}

// Días transcurridos desde una fecha AAAA-MM-DD.
export function diasDesde(fecha: string): number {
  const inicio = new Date(`${fecha}T00:00:00`).getTime();
  return Math.floor((Date.now() - inicio) / 86400000);
}

// Convierte el texto de un campo a número; null si está vacío o no es válido.
export function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// Monto en pesos con formato chileno.
export function pesos(valor: number | string): string {
  return `$${Number(valor).toLocaleString("es-CL")}`;
}

function ordenZona(zona: string): number {
  const i = ORDEN_ZONAS.indexOf(zona);
  return i === -1 ? 99 : i;
}

// Extrae los kilos de un tramo ("S_3kg" → 3, "XS_0.85kg" → 0.85).
function kgDe(tramo: string): number {
  const m = tramo.match(/(\d+(?:\.\d+)?)kg/i);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

// Agrupa las tarifas de un transportista por servicio y origen.
export function agrupar(tarifas: Tarifa[]): GrupoTarifas[] {
  const grupos = new Map<string, GrupoTarifas>();
  for (const t of tarifas) {
    const clave = `${t.servicio}|${t.zona_origen}`;
    let g = grupos.get(clave);
    if (!g) {
      g = { clave, servicio: t.servicio, origen: t.zona_origen, zonas: [], tramos: [], celdas: new Map() };
      grupos.set(clave, g);
    }
    if (!g.zonas.includes(t.zona_destino)) g.zonas.push(t.zona_destino);
    if (!g.tramos.includes(t.quiebre_peso)) g.tramos.push(t.quiebre_peso);
    g.celdas.set(`${t.zona_destino}|${t.quiebre_peso}`, t);
  }
  const lista = [...grupos.values()];
  for (const g of lista) {
    g.zonas.sort((a, b) => ordenZona(a) - ordenZona(b) || a.localeCompare(b, "es"));
    g.tramos.sort((a, b) => kgDe(a) - kgDe(b) || a.localeCompare(b, "es"));
  }
  return lista.sort(
    (a, b) => a.servicio.localeCompare(b.servicio, "es") || a.origen.localeCompare(b.origen, "es")
  );
}

// Convierte las filas de notas (con el criterio embebido) a una lista
// plana, descartando las que lleguen sin criterio.
export function normalizarNotas(filas: FilaNota[]): NotaCriterio[] {
  const resultado: NotaCriterio[] = [];
  for (const fila of filas) {
    const criterio = Array.isArray(fila.scoring_criteria)
      ? fila.scoring_criteria[0] ?? null
      : fila.scoring_criteria;
    if (!criterio) continue;
    resultado.push({
      optionId: fila.option_id,
      criterioId: criterio.id,
      nombre: criterio.nombre,
      peso: Number(criterio.peso_base),
      nota: Number(fila.calificacion),
    });
  }
  return resultado;
}

// Puntaje base (escala 0-100): promedio ponderado de las notas con los
// pesos base, igual que el motor pero SIN las reglas de ajuste. Devuelve
// null si no hay notas.
export function puntajeBase(notas: NotaCriterio[]): number | null {
  let sumaPonderada = 0;
  let sumaPesos = 0;
  for (const n of notas) {
    sumaPonderada += n.nota * n.peso;
    sumaPesos += n.peso;
  }
  if (sumaPesos <= 0) return null;
  return Math.round((sumaPonderada / sumaPesos) * 20 * 10) / 10;
}

// El enlace se muestra a las personas, así que debe ser https y tener un
// dominio con punto.
export function enlaceValido(texto: string): boolean {
  if (texto.length === 0 || texto.length > 500) return false;
  try {
    const url = new URL(texto);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}