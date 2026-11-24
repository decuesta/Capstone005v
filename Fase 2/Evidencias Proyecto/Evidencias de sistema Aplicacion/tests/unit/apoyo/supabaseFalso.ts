// ============================================================
// tests/unit/apoyo/supabaseFalso.ts
// Reemplazo en memoria del cliente de Supabase para las pruebas
// unitarias del motor (utils/scoringEngine.ts). No se conecta a
// ninguna base: responde con las tablas que cada prueba carga en
// `tablas`. Implementa solo lo que usa el motor: from, select, eq,
// in, ilike, order, limit, single y maybeSingle.
// ============================================================

type Fila = Record<string, unknown>;

// Datos de la prueba en curso. Cada prueba los reemplaza con cargarTablas().
export const tablas: Record<string, Fila[]> = {};

// Registro de las tablas consultadas, para comprobar, por ejemplo, que la
// ruta "aún no es momento" no consulta la base.
export const consultas: string[] = [];

export function cargarTablas(nuevas: Record<string, Fila[]>) {
  for (const k of Object.keys(tablas)) delete tablas[k];
  Object.assign(tablas, structuredClone(nuevas));
  consultas.length = 0;
}

function comoPatron(ilike: string): RegExp {
  const escapado = ilike.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escapado}$`, "i");
}

class Consulta implements PromiseLike<{ data: unknown; error: null | { message: string } }> {
  private filas: Fila[];
  private modo: "lista" | "una" | "unaOpcional" = "lista";

  constructor(tabla: string) {
    consultas.push(tabla);
    this.filas = [...(tablas[tabla] ?? [])];
  }

  select() {
    return this;
  }
  eq(columna: string, valor: unknown) {
    this.filas = this.filas.filter((f) => f[columna] === valor);
    return this;
  }
  in(columna: string, valores: unknown[]) {
    this.filas = this.filas.filter((f) => valores.includes(f[columna]));
    return this;
  }
  ilike(columna: string, patron: string) {
    const re = comoPatron(patron);
    this.filas = this.filas.filter((f) => re.test(String(f[columna])));
    return this;
  }
  order(columna: string, opciones?: { ascending?: boolean }) {
    const asc = opciones?.ascending ?? true;
    this.filas.sort((a, b) => {
      const x = a[columna] as number | string;
      const y = b[columna] as number | string;
      if (x === y) return 0;
      return (x < y ? -1 : 1) * (asc ? 1 : -1);
    });
    return this;
  }
  limit(n: number) {
    this.filas = this.filas.slice(0, n);
    return this;
  }
  single() {
    this.modo = "una";
    return this;
  }
  maybeSingle() {
    this.modo = "unaOpcional";
    return this;
  }

  private resolver() {
    if (this.modo === "lista") return { data: this.filas, error: null };
    if (this.filas.length === 1) return { data: this.filas[0], error: null };
    if (this.filas.length === 0 && this.modo === "unaOpcional") return { data: null, error: null };
    return { data: null, error: { message: `se esperaba una fila y hay ${this.filas.length}` } };
  }

  then<R1, R2>(
    ok?: ((v: { data: unknown; error: null | { message: string } }) => R1 | PromiseLike<R1>) | null,
    fallo?: ((e: unknown) => R2 | PromiseLike<R2>) | null
  ) {
    return Promise.resolve(this.resolver()).then(ok, fallo);
  }
}

export const supabaseFalso = {
  from: (tabla: string) => new Consulta(tabla),
};
