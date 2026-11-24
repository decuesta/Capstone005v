// ============================================================
// app/admin/page.tsx
// Panel de administración (RF-16 a RF-19) — Paso 5: mantenedor de
// plataformas y comisiones (RF-16). Incluye el control de acceso, la
// lista del plan vigente de cada plataforma, su edición, la creación
// de plataformas nuevas, el detalle de solo lectura de cada una
// (datos, plan vigente, historial de planes, notas por criterio y
// puntaje base comparado con las demás plataformas) y la edición de
// sus notas por criterio.
// Edición de plan:
// - Si cambia el precio o la comisión, se crea un plan nuevo con la
//   fecha de hoy y el anterior queda como historial. Si ya existe un
//   plan con la fecha de hoy, se modifica ese (no quedan dos con la
//   misma fecha). El motor usa siempre el plan más reciente.
// - Validaciones: precio entero >= 0, comisión entre 0 y 100, enlace
//   https válido, y no se puede desactivar la última plataforma activa
//   (esta última regla solo la aplica la pantalla, no la base).
// Creación:
// - Se hace con la función crear_plataforma de la base, que crea la
//   plataforma, su plan inicial y una nota por criterio en una sola
//   transacción (si algo falla, no queda nada a medias) y vuelve a
//   validar todo. La plataforma nace INACTIVA: se activa después con
//   "Editar", cuando se revisaron los datos.
// Edición de notas:
// - Se hace con la función actualizar_notas_plataforma de la base, que
//   valida y reemplaza las notas de la plataforma en una sola
//   transacción. NO guarda historial: la nota nueva sobrescribe la
//   anterior (decisión del MVP; a valorar para el paso a productivo).
//   Cambiar las notas de una plataforma ACTIVA cambia las
//   recomendaciones de los diagnósticos nuevos al instante.
// Detalle (solo lectura):
// - El puntaje base se calcula como lo hace el motor (promedio
//   ponderado de las notas con los pesos base, en escala 0-100), pero
//   SIN las reglas de ajuste que el motor aplica según las respuestas
//   del diagnóstico: no es el puntaje que verá una persona.
// - No hay opción de eliminar: solo desactivar. Borrar se hace desde
//   la base de datos.
// El acceso se decide con la misma función que usan las políticas de
// la base (es_administrador). Esconder la pantalla es una comodidad:
// la protección real son las políticas de Row Level Security.
// Solo escritorio: no forma parte de la PWA (RF-23).
// ============================================================
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import AvisoVigencia from "./transportistas/AvisoVigencia";

type EstadoAcceso = "verificando" | "sin_sesion" | "sin_permiso" | "admin" | "error";

interface OpcionPlataforma {
  nombre: string;
  activo: boolean;
  enlace_afiliado: string | null;
  es_afiliado: boolean;
}

interface FilaPlan {
  id: string;
  plataforma_option_id: string;
  nombre_plan: string;
  precio_mensual_clp: number | string;
  comision_transaccion_pct: number | string;
  fecha_vigencia: string;
  scoring_option: OpcionPlataforma | OpcionPlataforma[] | null;
}

interface Criterio {
  id: string;
  nombre: string;
  peso_base: number | string;
}

// Fila de scoring_option_rating con su criterio embebido (puede llegar
// como objeto o como lista de un elemento).
interface FilaNota {
  option_id: string;
  calificacion: number | string;
  scoring_criteria: Criterio | Criterio[] | null;
}

interface NotaCriterio {
  optionId: string;
  criterioId: string;
  nombre: string;
  peso: number;
  nota: number;
}

interface PlataformaResumen {
  id: string;
  nombre: string;
  activo: boolean;
}

interface Mensaje {
  texto: string;
  tipo: "ok" | "error";
}

// La relación puede llegar como objeto o como lista de un elemento,
// según cómo la interprete la librería; se normaliza a un objeto.
function opcionDe(fila: FilaPlan): OpcionPlataforma | null {
  const opcion = fila.scoring_option;
  return Array.isArray(opcion) ? opcion[0] ?? null : opcion;
}

// Deja solo el plan vigente de cada plataforma: el de fecha de
// vigencia más reciente, igual que hace el motor al calcular costos.
function planesVigentes(planes: FilaPlan[]): FilaPlan[] {
  const vigentes = new Map<string, FilaPlan>();
  for (const fila of planes) {
    const actual = vigentes.get(fila.plataforma_option_id);
    if (!actual || fila.fecha_vigencia > actual.fecha_vigencia) {
      vigentes.set(fila.plataforma_option_id, fila);
    }
  }
  return [...vigentes.values()].sort((a, b) =>
    (opcionDe(a)?.nombre ?? "").localeCompare(opcionDe(b)?.nombre ?? "", "es")
  );
}

// Fecha de hoy (hora local) en formato AAAA-MM-DD.
function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Fecha AAAA-MM-DD en formato chileno.
function fechaCL(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL");
}

// Convierte el texto de un campo a número; null si está vacío o no es válido.
function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// El enlace se muestra a los usuarios, así que debe ser https y tener
// un dominio con punto.
function enlaceValido(texto: string): boolean {
  if (texto.length === 0 || texto.length > 500) return false;
  try {
    const url = new URL(texto);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

// Convierte las filas de notas (con el criterio embebido) a una lista
// plana, descartando las que lleguen sin criterio.
function normalizarNotas(filas: FilaNota[]): NotaCriterio[] {
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
function puntajeBase(notas: NotaCriterio[]): number | null {
  let sumaPonderada = 0;
  let sumaPesos = 0;
  for (const n of notas) {
    sumaPonderada += n.nota * n.peso;
    sumaPesos += n.peso;
  }
  if (sumaPesos <= 0) return null;
  return Math.round((sumaPonderada / sumaPesos) * 20 * 10) / 10;
}

function Aviso({
  titulo,
  texto,
  conEnlaceInicio,
}: {
  titulo: string;
  texto: string;
  conEnlaceInicio?: boolean;
}) {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-md mx-auto mt-24 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <p className="text-sm text-slate-500">{texto}</p>
        {conEnlaceInicio && (
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all"
          >
            Ir al inicio
          </Link>
        )}
      </div>
    </main>
  );
}

// ------------------------------------------------------------
// Detalle de una plataforma, de solo lectura (ventana superpuesta).
// Muestra datos, plan vigente, historial de planes, notas por criterio
// y el puntaje base comparado con las demás plataformas. Desde aquí se
// abre la edición de notas.
// ------------------------------------------------------------
interface DetallePlataformaProps {
  fila: FilaPlan;
  opcion: OpcionPlataforma;
  historial: FilaPlan[];
  plataformas: PlataformaResumen[];
  onEditarNotas: () => void;
  onCerrar: () => void;
}

function DetallePlataforma({
  fila,
  opcion,
  historial,
  plataformas,
  onEditarNotas,
  onCerrar,
}: DetallePlataformaProps) {
  const [notas, setNotas] = useState<NotaCriterio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clave estable para el efecto: evita volver a pedir las notas si el
  // padre vuelve a crear la lista de plataformas con el mismo contenido.
  const claveIds = plataformas.map((p) => p.id).join(",");

  useEffect(() => {
    let montado = true;

    async function cargarNotas() {
      const { data, error: errorNotas } = await supabase
        .from("scoring_option_rating")
        .select("option_id, calificacion, scoring_criteria(id, nombre, peso_base)")
        .in("option_id", claveIds.split(","));
      if (!montado) return;
      if (errorNotas) {
        console.error("No se pudieron cargar las notas:", errorNotas.message);
        setError("No pudimos cargar las notas. Cierra esta ventana e intenta de nuevo.");
      } else {
        setNotas(normalizarNotas((data ?? []) as unknown as FilaNota[]));
      }
      setCargando(false);
    }
    cargarNotas();

    return () => {
      montado = false;
    };
  }, [claveIds]);

  const idEsta = fila.plataforma_option_id;
  const notasDeEsta = notas
    .filter((n) => n.optionId === idEsta)
    .sort((a, b) => b.peso - a.peso || a.nombre.localeCompare(b.nombre, "es"));
  const puntajeEsta = puntajeBase(notasDeEsta);

  const ranking = plataformas
    .map((p) => ({
      ...p,
      puntaje: puntajeBase(notas.filter((n) => n.optionId === p.id)),
    }))
    .sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1) || a.nombre.localeCompare(b.nombre, "es"));

  const enlace = opcion.enlace_afiliado;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Detalle de {opcion.nombre}</h2>
            <p className="text-sm text-slate-500">Solo lectura.</p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              opcion.activo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {opcion.activo ? "Activa" : "Inactiva"}
          </span>
        </div>

        <section className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">Datos</h3>
          <p className="text-sm text-slate-700">
            <span className="text-slate-500">Enlace de afiliado: </span>
            {enlace && enlace.startsWith("https://") ? (
              <a
                href={enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline break-all"
              >
                {enlace}
              </a>
            ) : (
              <span className="break-all">{enlace ?? "Sin enlace"}</span>
            )}
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">Plan vigente</h3>
          <p className="text-sm text-slate-700">
            {fila.nombre_plan} — ${Number(fila.precio_mensual_clp).toLocaleString("es-CL")} al mes, comisión{" "}
            {Number(fila.comision_transaccion_pct)}%, vigente desde {fechaCL(fila.fecha_vigencia)}.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Historial de planes</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">Vigencia</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Precio mensual</th>
                <th className="py-2">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((plan, indice) => (
                <tr key={plan.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4">
                    {fechaCL(plan.fecha_vigencia)}
                    {indice === 0 && (
                      <span className="ml-2 text-xs font-semibold text-blue-600">Vigente</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{plan.nombre_plan}</td>
                  <td className="py-2 pr-4">${Number(plan.precio_mensual_clp).toLocaleString("es-CL")}</td>
                  <td className="py-2">{Number(plan.comision_transaccion_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-900">Notas por criterio</h3>
            {!cargando && !error && (
              <button
                onClick={onEditarNotas}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Editar notas
              </button>
            )}
          </div>
          {cargando && <p className="text-sm text-slate-500">Cargando notas...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!cargando && !error && notasDeEsta.length === 0 && (
            <p className="text-sm text-slate-500">Esta plataforma no tiene notas cargadas.</p>
          )}
          {!cargando && !error && notasDeEsta.length > 0 && (
            <>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Criterio</th>
                    <th className="py-2 pr-4">Peso base</th>
                    <th className="py-2">Nota (1 a 5)</th>
                  </tr>
                </thead>
                <tbody>
                  {notasDeEsta.map((n) => (
                    <tr key={n.criterioId} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{n.nombre}</td>
                      <td className="py-2 pr-4">{n.peso}%</td>
                      <td className="py-2 font-semibold">{n.nota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-slate-700">
                <strong>Puntaje base:</strong> {puntajeEsta === null ? "—" : `${puntajeEsta.toFixed(1)}/100`}
              </p>
            </>
          )}
        </section>

        {!cargando && !error && (
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900">Comparación con las demás plataformas</h3>
            <ul className="space-y-2">
              {ranking.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                    p.id === idEsta ? "bg-blue-50 border border-blue-200" : "border border-slate-100"
                  }`}
                >
                  <span className="font-semibold text-slate-800">
                    {p.nombre}{" "}
                    <span className="font-normal text-xs text-slate-500">
                      ({p.activo ? "Activa" : "Inactiva"})
                    </span>
                  </span>
                  <span className="text-slate-700">
                    {p.puntaje === null ? "Sin notas" : `${p.puntaje.toFixed(1)}/100`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
              El puntaje base usa los pesos base de los criterios, sin las reglas de ajuste que aplica el
              sistema según las respuestas de cada diagnóstico. No es el puntaje que verá una persona: sirve
              para comparar plataformas entre sí.
            </p>
          </section>
        )}

        <p className="text-xs text-slate-500">
          Para cambiar el precio, la comisión, el enlace o el estado, usa "Editar" en la tabla. Para cambiar
          las notas, usa "Editar notas".
        </p>

        <div className="flex justify-end">
          <button
            onClick={onCerrar}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Edición de las notas por criterio de una plataforma (ventana
// superpuesta). Muestra un selector de 1 a 5 por cada criterio, ya con
// la nota actual. Al guardar, la confirmación lista solo las notas que
// cambian y el puntaje base antes y después. Todo se guarda de una vez
// con la función actualizar_notas_plataforma (si algo falla, no cambia
// ninguna nota). No guarda historial.
// ------------------------------------------------------------
interface EditorNotasProps {
  fila: FilaPlan;
  opcion: OpcionPlataforma;
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

function EditorNotas({ fila, opcion, onCancelar, onTerminar }: EditorNotasProps) {
  const idPlataforma = fila.plataforma_option_id;
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [actuales, setActuales] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Lee los criterios de la categoría de plataformas y las notas
  // actuales de esta plataforma.
  useEffect(() => {
    let montado = true;

    async function cargar() {
      const { data: categoria, error: errorCategoria } = await supabase
        .from("scoring_category")
        .select("id")
        .eq("nombre", "Plataformas E-Commerce")
        .single();
      if (!montado) return;
      if (errorCategoria || !categoria) {
        console.error("No se pudo leer la categoría de plataformas:", errorCategoria?.message);
        setErrorCarga("No pudimos cargar los criterios. Cierra esta ventana e intenta de nuevo.");
        setCargando(false);
        return;
      }

      const [respuestaCriterios, respuestaNotas] = await Promise.all([
        supabase
          .from("scoring_criteria")
          .select("id, nombre, peso_base")
          .eq("categoria_id", categoria.id),
        supabase
          .from("scoring_option_rating")
          .select("criteria_id, calificacion")
          .eq("option_id", idPlataforma),
      ]);
      if (!montado) return;

      if (
        respuestaCriterios.error ||
        !respuestaCriterios.data ||
        respuestaCriterios.data.length === 0 ||
        respuestaNotas.error
      ) {
        console.error(
          "No se pudieron leer los criterios o las notas:",
          respuestaCriterios.error?.message ?? respuestaNotas.error?.message
        );
        setErrorCarga("No pudimos cargar las notas. Cierra esta ventana e intenta de nuevo.");
        setCargando(false);
        return;
      }

      const ordenados = [...(respuestaCriterios.data as Criterio[])].sort(
        (a, b) => Number(b.peso_base) - Number(a.peso_base) || a.nombre.localeCompare(b.nombre, "es")
      );
      const mapa: Record<string, string> = {};
      for (const n of respuestaNotas.data ?? []) {
        mapa[n.criteria_id as string] = String(Number(n.calificacion));
      }
      setCriterios(ordenados);
      setActuales(mapa);
      setNotas(mapa);
      setCargando(false);
    }
    cargar();

    return () => {
      montado = false;
    };
  }, [idPlataforma]);

  // Convierte un mapa criterio → nota (texto) en la lista que usa el
  // cálculo del puntaje base, saltando los criterios sin nota.
  function comoNotas(valores: Record<string, string>): NotaCriterio[] {
    return criterios
      .filter((c) => (valores[c.id] ?? "") !== "")
      .map((c) => ({
        optionId: idPlataforma,
        criterioId: c.id,
        nombre: c.nombre,
        peso: Number(c.peso_base),
        nota: Number(valores[c.id]),
      }));
  }

  async function guardar() {
    setError(null);

    // 1) Validaciones (la base las vuelve a comprobar).
    if (criterios.length === 0) {
      setError("No hay criterios cargados. Cierra esta ventana e intenta de nuevo.");
      return;
    }
    const faltantes = criterios.filter((c) => !["1", "2", "3", "4", "5"].includes(notas[c.id] ?? ""));
    if (faltantes.length > 0) {
      setError(`Falta la nota de: ${faltantes.map((c) => c.nombre).join(", ")}.`);
      return;
    }
    const cambiadas = criterios.filter((c) => notas[c.id] !== actuales[c.id]);
    if (cambiadas.length === 0) {
      setError("No hay cambios para guardar.");
      return;
    }

    // 2) Confirmación: solo las notas que cambian y el puntaje base.
    const antes = puntajeBase(comoNotas(actuales));
    const despues = puntajeBase(comoNotas(notas));
    const lineas = cambiadas
      .map((c) => `  ${c.nombre}: ${actuales[c.id] ?? "sin nota"} → ${notas[c.id]}`)
      .join("\n");
    const lineaPuntaje = `Puntaje base: ${antes === null ? "—" : antes.toFixed(1)} → ${
      despues === null ? "—" : despues.toFixed(1)
    }`;
    const aviso = opcion.activo
      ? `${opcion.nombre} está ACTIVA: el cambio afecta a las recomendaciones de los diagnósticos nuevos desde ahora.`
      : `${opcion.nombre} está inactiva: el cambio no afecta a los diagnósticos hasta que la actives.`;
    const confirmado = window.confirm(
      `Notas de ${opcion.nombre}:\n\n${lineas}\n\n${lineaPuntaje}\n\n${aviso}\n` +
        `No se guarda historial: la nota anterior se pierde.\n\n¿Confirmas?`
    );
    if (!confirmado) return;

    // 3) Guardado en una sola transacción, con la función de la base.
    setGuardando(true);
    try {
      const { data, error: errorRpc } = await supabase.rpc("actualizar_notas_plataforma", {
        p_option_id: idPlataforma,
        p_notas: criterios.map((c) => ({ criteria_id: c.id, calificacion: Number(notas[c.id]) })),
      });
      if (errorRpc) {
        console.error("Error al actualizar las notas:", errorRpc.message);
        setError(`No se pudo guardar: ${errorRpc.message}`);
        return;
      }
      const cantidad = Number(data ?? 0);
      onTerminar(
        cantidad === 0
          ? `Las notas de ${opcion.nombre} ya tenían esos valores: no se cambió nada.`
          : `Notas de ${opcion.nombre} actualizadas (${cantidad} ${cantidad === 1 ? "cambiada" : "cambiadas"}).`,
        "ok"
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Editar notas de {opcion.nombre}</h2>
          <p className="text-sm text-slate-500">
            De 1 (muy débil) a 5 (muy fuerte). Son criterio del equipo: respáldalas con fuentes.
          </p>
        </div>

        {cargando && <p className="text-sm text-slate-500">Cargando notas...</p>}
        {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

        <div className="space-y-2">
          {criterios.map((c) => {
            const cambiada = (notas[c.id] ?? "") !== (actuales[c.id] ?? "");
            return (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <label htmlFor={`editar-nota-${c.id}`} className="text-sm text-slate-700">
                  {c.nombre}{" "}
                  <span className="text-xs text-slate-400">(peso {Number(c.peso_base)}%)</span>
                  {cambiada && <span className="ml-2 text-xs font-semibold text-blue-600">cambiada</span>}
                </label>
                <select
                  id={`editar-nota-${c.id}`}
                  value={notas[c.id] ?? ""}
                  onChange={(e) => setNotas((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className="w-28 p-2 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="">Elige</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <p
          className={`text-xs rounded-xl p-3 border ${
            opcion.activo
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}
        >
          {opcion.activo
            ? "Esta plataforma está activa: al guardar, las recomendaciones de los diagnósticos nuevos cambian al instante. Los diagnósticos ya guardados no cambian."
            : "Esta plataforma está inactiva: los cambios no afectan a los diagnósticos hasta que la actives."}{" "}
          No se guarda historial de notas: la nota anterior se pierde.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancelar}
            disabled={guardando}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || cargando || !!errorCarga}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
          >
            {guardando ? "Guardando..." : "Guardar notas"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Formulario de edición de una plataforma (ventana superpuesta).
// ------------------------------------------------------------
interface EditorPlanProps {
  fila: FilaPlan;
  opcion: OpcionPlataforma;
  hayOtraActiva: boolean;
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

function EditorPlan({ fila, opcion, hayOtraActiva, onCancelar, onTerminar }: EditorPlanProps) {
  const [precio, setPrecio] = useState(String(Number(fila.precio_mensual_clp)));
  const [comision, setComision] = useState(String(Number(fila.comision_transaccion_pct)));
  const [enlace, setEnlace] = useState(opcion.enlace_afiliado ?? "");
  const [activa, setActiva] = useState(opcion.activo);
    const [esAfiliado, setEsAfiliado] = useState(opcion.es_afiliado);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);

    // 1) Validaciones
    const precioNuevo = aNumero(precio);
    if (precioNuevo === null || !Number.isInteger(precioNuevo) || precioNuevo < 0) {
      setError("El precio mensual debe ser un número entero en pesos, mayor o igual a 0.");
      return;
    }
    const comisionNueva = aNumero(comision);
    if (comisionNueva === null || comisionNueva < 0 || comisionNueva > 100) {
      setError("La comisión debe ser un número entre 0 y 100.");
      return;
    }
    const enlaceNuevo = enlace.trim();
    if (!enlaceValido(enlaceNuevo)) {
      setError("El enlace de afiliado debe comenzar con https:// y ser una dirección válida.");
      return;
    }
    if (opcion.activo && !activa && !hayOtraActiva) {
      setError("No se puede desactivar la última plataforma activa: el sistema no tendría qué recomendar.");
      return;
    }

    // 2) ¿Qué cambió?
    const precioActual = Number(fila.precio_mensual_clp);
    const comisionActual = Number(fila.comision_transaccion_pct);
    const enlaceActual = opcion.enlace_afiliado ?? "";
    const cambioPlan = precioNuevo !== precioActual || comisionNueva !== comisionActual;
        const cambioOpcion =
      enlaceNuevo !== enlaceActual || activa !== opcion.activo || esAfiliado !== opcion.es_afiliado;
    if (!cambioPlan && !cambioOpcion) {
      setError("No hay cambios para guardar.");
      return;
    }

    // 3) Confirmación con el resumen de lo que cambia
    const hoy = hoyISO();
    const lineas: string[] = [];
    if (precioNuevo !== precioActual) {
      lineas.push(`Precio mensual: $${precioActual.toLocaleString("es-CL")} → $${precioNuevo.toLocaleString("es-CL")}`);
    }
    if (comisionNueva !== comisionActual) {
      lineas.push(`Comisión: ${comisionActual}% → ${comisionNueva}%`);
    }
    if (enlaceNuevo !== enlaceActual) {
      lineas.push("Enlace de afiliado: se actualiza");
    }
    if (activa !== opcion.activo) {
      lineas.push(`Estado: ${opcion.activo ? "Activa" : "Inactiva"} → ${activa ? "Activa" : "Inactiva"}`);
          if (esAfiliado !== opcion.es_afiliado) {
      lineas.push(
        `Enlace de afiliado (aviso de comisión): ${opcion.es_afiliado ? "Sí" : "No"} → ${esAfiliado ? "Sí" : "No"}`
      );
    }
    }
    const avisoPlan = cambioPlan
      ? fila.fecha_vigencia === hoy
        ? "\n\nSe actualizará el plan registrado hoy."
        : "\n\nSe creará un plan nuevo con la fecha de hoy y el anterior quedará como historial."
      : "";
    const confirmado = window.confirm(
      `Cambios en ${opcion.nombre}:\n\n${lineas.join("\n")}${avisoPlan}\n\nEstos cambios afectan a los diagnósticos nuevos. ¿Confirmas?`
    );
    if (!confirmado) return;

    // 4) Escritura. Primero el plan, después la plataforma. Cada
    //    escritura pide de vuelta la fila para detectar el caso en que
    //    la base la rechaza sin devolver error (0 filas modificadas).
    setGuardando(true);
    let algoGuardado = false;
    try {
      if (cambioPlan) {
        if (fila.fecha_vigencia === hoy) {
          const { data, error: errorPlan } = await supabase
            .from("planes_plataforma")
            .update({
              precio_mensual_clp: precioNuevo,
              comision_transaccion_pct: comisionNueva,
            })
            .eq("id", fila.id)
            .select("id");
          if (errorPlan) throw new Error(errorPlan.message);
          if (!data || data.length === 0) {
            throw new Error("La base no aceptó el cambio del plan (revisa tu sesión y tus permisos).");
          }
        } else {
          const { data, error: errorPlan } = await supabase
            .from("planes_plataforma")
            .insert({
              plataforma_option_id: fila.plataforma_option_id,
              nombre_plan: fila.nombre_plan,
              precio_mensual_clp: precioNuevo,
              comision_transaccion_pct: comisionNueva,
              fecha_vigencia: hoy,
            })
            .select("id");
          if (errorPlan) throw new Error(errorPlan.message);
          if (!data || data.length === 0) {
            throw new Error("La base no aceptó el plan nuevo (revisa tu sesión y tus permisos).");
          }
        }
        algoGuardado = true;
      }

      if (cambioOpcion) {
        const { data, error: errorOpcion } = await supabase
          .from("scoring_option")
                    .update({ enlace_afiliado: enlaceNuevo, activo: activa, es_afiliado: esAfiliado })
          .eq("id", fila.plataforma_option_id)
          .select("id");
        if (errorOpcion) throw new Error(errorOpcion.message);
        if (!data || data.length === 0) {
          throw new Error("La base no aceptó el cambio de enlace o estado (revisa tu sesión y tus permisos).");
        }
        algoGuardado = true;
      }

      onTerminar(`Cambios guardados en ${opcion.nombre}.`, "ok");
    } catch (e) {
      const detalle = e instanceof Error ? e.message : "Error desconocido.";
      console.error("Error al guardar los cambios:", detalle);
      if (algoGuardado) {
        onTerminar(
          `Se guardó solo una parte de los cambios en ${opcion.nombre}: ${detalle} Revisa la tabla y vuelve a intentarlo.`,
          "error"
        );
      } else {
        setError(`No se pudo guardar: ${detalle}`);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Editar {opcion.nombre}</h2>
          <p className="text-sm text-slate-500">
            Plan {fila.nombre_plan}, vigente desde{" "}
            {new Date(`${fila.fecha_vigencia}T00:00:00`).toLocaleDateString("es-CL")}.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="precio" className="block text-sm font-semibold text-slate-700 mb-1">
              Precio mensual (CLP, con IVA)
            </label>
            <input
              id="precio"
              type="number"
              min={0}
              step={1}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="comision" className="block text-sm font-semibold text-slate-700 mb-1">
              Comisión por transacción (%)
            </label>
            <input
              id="comision"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={comision}
              onChange={(e) => setComision(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="enlace" className="block text-sm font-semibold text-slate-700 mb-1">
              Enlace de afiliado
            </label>
            <input
              id="enlace"
              type="text"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://..."
              className="w-full p-3 border border-slate-200 rounded-xl"
            />
            <p className="text-xs text-slate-500 mt-1">
              Debe comenzar con https://. Es el enlace que se muestra a los usuarios.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={activa}
              onChange={(e) => setActiva(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-slate-700">
              Plataforma activa (se incluye en las recomendaciones).
            </span>
          </label>
                    <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={esAfiliado}
              onChange={(e) => setEsAfiliado(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-slate-700">
              Este enlace es de afiliado (E-Match puede recibir una comisión). Márcala solo si es el enlace que
              entrega el programa de afiliados: con la casilla marcada, los resultados muestran un aviso de
              comisión. Los diagnósticos ya guardados conservan el enlace que tenían.
            </span>
          </label>
        </div>

        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
          Si cambias el precio o la comisión, se guarda como un plan nuevo con la fecha de hoy y el
          anterior queda como historial. Los diagnósticos ya guardados no cambian.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancelar}
            disabled={guardando}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Formulario para agregar una plataforma nueva (ventana superpuesta).
// Pide los datos de la plataforma, su plan inicial y una nota de 1 a 5
// por cada criterio (se leen de la base). Todo se crea de una vez con
// la función crear_plataforma; la plataforma queda INACTIVA.
// ------------------------------------------------------------
interface NuevaPlataformaProps {
  nombresExistentes: string[];
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

function NuevaPlataforma({ nombresExistentes, onCancelar, onTerminar }: NuevaPlataformaProps) {
  const [nombre, setNombre] = useState("");
  const [enlace, setEnlace] = useState("");
  const [nombrePlan, setNombrePlan] = useState("");
  const [precio, setPrecio] = useState("");
  const [comision, setComision] = useState("");
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [cargandoCriterios, setCargandoCriterios] = useState(true);
  const [errorCriterios, setErrorCriterios] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Lee los criterios de la categoría de plataformas (los mismos que
  // usa el motor), para pedir una nota por cada uno.
  useEffect(() => {
    let montado = true;

    async function cargarCriterios() {
      const { data: categoria, error: errorCategoria } = await supabase
        .from("scoring_category")
        .select("id")
        .eq("nombre", "Plataformas E-Commerce")
        .single();
      if (!montado) return;
      if (errorCategoria || !categoria) {
        console.error("No se pudo leer la categoría de plataformas:", errorCategoria?.message);
        setErrorCriterios("No pudimos cargar los criterios. Cierra esta ventana e intenta de nuevo.");
        setCargandoCriterios(false);
        return;
      }

      const { data, error: errorLista } = await supabase
        .from("scoring_criteria")
        .select("id, nombre, peso_base")
        .eq("categoria_id", categoria.id)
        .order("peso_base", { ascending: false });
      if (!montado) return;
      if (errorLista || !data || data.length === 0) {
        console.error("No se pudieron leer los criterios:", errorLista?.message);
        setErrorCriterios("No pudimos cargar los criterios. Cierra esta ventana e intenta de nuevo.");
      } else {
        setCriterios(data as Criterio[]);
      }
      setCargandoCriterios(false);
    }
    cargarCriterios();

    return () => {
      montado = false;
    };
  }, []);

  async function guardar() {
    setError(null);

    // 1) Validaciones (la base las vuelve a comprobar).
    const nombreLimpio = nombre.trim();
    if (nombreLimpio.length < 1 || nombreLimpio.length > 60) {
      setError("El nombre de la plataforma es obligatorio (máximo 60 caracteres).");
      return;
    }
    if (nombresExistentes.some((n) => n.trim().toLowerCase() === nombreLimpio.toLowerCase())) {
      setError("Ya existe una plataforma con ese nombre.");
      return;
    }
    const nombrePlanLimpio = nombrePlan.trim();
    if (nombrePlanLimpio.length < 1 || nombrePlanLimpio.length > 100) {
      setError("El nombre del plan es obligatorio (máximo 100 caracteres).");
      return;
    }
    const enlaceLimpio = enlace.trim();
    if (!enlaceValido(enlaceLimpio)) {
      setError("El enlace de afiliado debe comenzar con https:// y ser una dirección válida.");
      return;
    }
    const precioNuevo = aNumero(precio);
    if (precioNuevo === null || !Number.isInteger(precioNuevo) || precioNuevo < 0) {
      setError("El precio mensual debe ser un número entero en pesos, mayor o igual a 0.");
      return;
    }
    const comisionNueva = aNumero(comision);
    if (comisionNueva === null || comisionNueva < 0 || comisionNueva > 100) {
      setError("La comisión debe ser un número entre 0 y 100.");
      return;
    }
    if (criterios.length === 0) {
      setError("No hay criterios cargados. Cierra esta ventana e intenta de nuevo.");
      return;
    }
    const faltantes = criterios.filter((c) => !["1", "2", "3", "4", "5"].includes(notas[c.id] ?? ""));
    if (faltantes.length > 0) {
      setError(`Falta la nota de: ${faltantes.map((c) => c.nombre).join(", ")}.`);
      return;
    }

    // 2) Confirmación con el resumen de lo que se va a crear.
    const lineasNotas = criterios.map((c) => `  ${c.nombre}: ${notas[c.id]}`).join("\n");
    const confirmado = window.confirm(
      `Se creará la plataforma ${nombreLimpio}:\n\n` +
        `Plan: ${nombrePlanLimpio}\n` +
        `Precio mensual: $${precioNuevo.toLocaleString("es-CL")}\n` +
        `Comisión: ${comisionNueva}%\n\n` +
        `Notas:\n${lineasNotas}\n\n` +
        `Quedará INACTIVA: no se recomendará hasta que la actives con "Editar". ¿Confirmas?`
    );
    if (!confirmado) return;

    // 3) Creación en una sola transacción, con la función de la base.
    setGuardando(true);
    try {
      const { error: errorRpc } = await supabase.rpc("crear_plataforma", {
        p_nombre: nombreLimpio,
        p_enlace: enlaceLimpio,
        p_nombre_plan: nombrePlanLimpio,
        p_precio_mensual_clp: precioNuevo,
        p_comision_pct: comisionNueva,
        p_notas: criterios.map((c) => ({ criteria_id: c.id, calificacion: Number(notas[c.id]) })),
      });
      if (errorRpc) {
        console.error("Error al crear la plataforma:", errorRpc.message);
        setError(`No se pudo crear: ${errorRpc.message}`);
        return;
      }
      onTerminar(
        `Plataforma ${nombreLimpio} creada como Inactiva. Revisa sus datos y actívala con "Editar" cuando estés listo.`,
        "ok"
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Agregar plataforma</h2>
          <p className="text-sm text-slate-500">
            Se crea inactiva. Después la revisas y la activas con "Editar".
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="nueva-nombre" className="block text-sm font-semibold text-slate-700 mb-1">
              Nombre de la plataforma
            </label>
            <input
              id="nueva-nombre"
              type="text"
              maxLength={60}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="nueva-enlace" className="block text-sm font-semibold text-slate-700 mb-1">
              Enlace de afiliado
            </label>
            <input
              id="nueva-enlace"
              type="text"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://..."
              className="w-full p-3 border border-slate-200 rounded-xl"
            />
            <p className="text-xs text-slate-500 mt-1">
              Debe comenzar con https://. Es el enlace que se muestra a los usuarios.
            </p>
          </div>

          <div>
            <label htmlFor="nueva-plan" className="block text-sm font-semibold text-slate-700 mb-1">
              Nombre del plan inicial
            </label>
            <input
              id="nueva-plan"
              type="text"
              maxLength={100}
              value={nombrePlan}
              onChange={(e) => setNombrePlan(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="nueva-precio" className="block text-sm font-semibold text-slate-700 mb-1">
                Precio mensual (CLP, con IVA)
              </label>
              <input
                id="nueva-precio"
                type="number"
                min={0}
                step={1}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="nueva-comision" className="block text-sm font-semibold text-slate-700 mb-1">
                Comisión por transacción (%)
              </label>
              <input
                id="nueva-comision"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            El plan inicial queda con la fecha de hoy.
          </p>

          <div>
            <p className="text-sm font-semibold text-slate-700">Notas por criterio</p>
            <p className="text-xs text-slate-500 mb-3">
              De 1 (muy débil) a 5 (muy fuerte). Son criterio del equipo: respáldalas con fuentes.
            </p>

            {cargandoCriterios && <p className="text-sm text-slate-500">Cargando criterios...</p>}
            {errorCriterios && <p className="text-sm text-red-600">{errorCriterios}</p>}

            <div className="space-y-2">
              {criterios.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <label htmlFor={`nota-${c.id}`} className="text-sm text-slate-700">
                    {c.nombre}{" "}
                    <span className="text-xs text-slate-400">(peso {Number(c.peso_base)}%)</span>
                  </label>
                  <select
                    id={`nota-${c.id}`}
                    value={notas[c.id] ?? ""}
                    onChange={(e) => setNotas((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    className="w-28 p-2 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="">Elige</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancelar}
            disabled={guardando}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || cargandoCriterios || !!errorCriterios}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
          >
            {guardando ? "Creando..." : "Crear plataforma"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [acceso, setAcceso] = useState<EstadoAcceso>("verificando");
  const [email, setEmail] = useState("");
  const [planes, setPlanes] = useState<FilaPlan[]>([]);
  const [cargandoPlanes, setCargandoPlanes] = useState(true);
  const [errorPlanes, setErrorPlanes] = useState<string | null>(null);
  const [editando, setEditando] = useState<FilaPlan | null>(null);
  const [editandoNotas, setEditandoNotas] = useState<FilaPlan | null>(null);
  const [detalle, setDetalle] = useState<FilaPlan | null>(null);
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  // 1) Verifica la sesión y el rol. No se llama a supabase dentro del
  //    listener de cambios de sesión (puede provocar un bloqueo); ahí
  //    solo se actualiza el estado.
  useEffect(() => {
    let montado = true;

    async function verificarAcceso() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!montado) return;
      if (!session?.user) {
        setAcceso("sin_sesion");
        return;
      }
      setEmail(session.user.email ?? "");

      const { data: esAdmin, error } = await supabase.rpc("es_administrador");
      if (!montado) return;
      if (error) {
        console.error("No se pudo verificar el rol de administrador:", error.message);
        setAcceso("error");
        return;
      }
      setAcceso(esAdmin === true ? "admin" : "sin_permiso");
    }
    verificarAcceso();

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!session) setAcceso("sin_sesion");
    });

    return () => {
      montado = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 2) Carga los planes (también se usa para recargar tras guardar).
  const cargarPlanes = useCallback(async () => {
    const { data, error } = await supabase
      .from("planes_plataforma")
      .select(
                "id, plataforma_option_id, nombre_plan, precio_mensual_clp, comision_transaccion_pct, fecha_vigencia, scoring_option(nombre, activo, enlace_afiliado, es_afiliado)"
      );
    if (error) {
      console.error("No se pudieron cargar los planes:", error.message);
      setErrorPlanes("No pudimos cargar los planes. Intenta de nuevo más tarde.");
    } else {
      setPlanes((data ?? []) as unknown as FilaPlan[]);
      setErrorPlanes(null);
    }
    setCargandoPlanes(false);
  }, []);

  useEffect(() => {
    if (acceso === "admin") cargarPlanes();
  }, [acceso, cargarPlanes]);

  // Cierra cualquier ventana abierta, muestra el aviso y recarga la tabla.
  async function terminarOperacion(texto: string, tipo: "ok" | "error") {
    setEditando(null);
    setEditandoNotas(null);
    setCreando(false);
    setMensaje({ texto, tipo });
    await cargarPlanes();
  }

  if (acceso === "verificando") {
    return <Aviso titulo="Verificando acceso..." texto="Un momento, por favor." />;
  }
  if (acceso === "sin_sesion") {
    return (
      <Aviso
        titulo="Necesitas iniciar sesión"
        texto="Inicia sesión con tu cuenta de administrador desde la pantalla de inicio y vuelve a esta página."
        conEnlaceInicio
      />
    );
  }
  if (acceso === "sin_permiso") {
    return (
      <Aviso
        titulo="No tienes acceso a esta sección"
        texto={`La cuenta ${email} no tiene permisos de administración.`}
        conEnlaceInicio
      />
    );
  }
  if (acceso === "error") {
    return (
      <Aviso
        titulo="No pudimos verificar tu acceso"
        texto="Intenta de nuevo en unos minutos."
        conEnlaceInicio
      />
    );
  }

  const filas = planesVigentes(planes);
  const opcionEditando = editando ? opcionDe(editando) : null;
  const opcionEditandoNotas = editandoNotas ? opcionDe(editandoNotas) : null;
  const opcionDetalle = detalle ? opcionDe(detalle) : null;

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Panel de administración</h1>
            <p className="text-sm text-slate-500">Sesión iniciada como {email}</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/admin/dashboard" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
              Dashboard →
            </Link>
            <Link href="/admin/transportistas" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
              Transportistas →
            </Link>
            <Link href="/admin/reglas" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
              Reglas →
            </Link>
            <Link href="/admin/agencias" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
              Agencias →
            </Link>
            <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
              ← Volver al inicio
            </Link>
          </div>
        </header>

        <AvisoVigencia />

        {mensaje && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              mensaje.tipo === "ok"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Plataformas e-commerce</h2>
              <p className="text-sm text-slate-500">
                Plan vigente de cada plataforma, con su comisión por venta.
              </p>
            </div>
            <button
              onClick={() => {
                setMensaje(null);
                setCreando(true);
              }}
              className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
            >
              + Agregar plataforma
            </button>
          </div>

          {cargandoPlanes && <p className="p-6 text-sm text-slate-500">Cargando...</p>}
          {errorPlanes && <p className="p-6 text-sm text-red-600">{errorPlanes}</p>}

          {!cargandoPlanes && !errorPlanes && filas.length === 0 && (
            <p className="p-6 text-sm text-slate-500">No hay planes cargados.</p>
          )}

          {!cargandoPlanes && !errorPlanes && filas.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Plataforma</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Precio mensual</th>
                  <th className="px-6 py-3">Comisión</th>
                  <th className="px-6 py-3">Vigencia</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const opcion = opcionDe(fila);
                  const activa = opcion?.activo ?? false;
                  return (
                    <tr key={fila.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 font-semibold text-slate-900">{opcion?.nombre ?? "—"}</td>
                      <td className="px-6 py-4">{fila.nombre_plan}</td>
                      <td className="px-6 py-4">
                        ${Number(fila.precio_mensual_clp).toLocaleString("es-CL")}
                      </td>
                      <td className="px-6 py-4">{Number(fila.comision_transaccion_pct)}%</td>
                      <td className="px-6 py-4">
                        {new Date(`${fila.fecha_vigencia}T00:00:00`).toLocaleDateString("es-CL")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            activa ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {opcion && (
                          <>
                            <button
                              onClick={() => {
                                setMensaje(null);
                                setDetalle(fila);
                              }}
                              className="text-sm font-semibold text-slate-600 hover:text-slate-900 mr-4"
                            >
                              Ver detalle
                            </button>
                            <button
                              onClick={() => {
                                setMensaje(null);
                                setEditando(fila);
                              }}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                            >
                              Editar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-4">
          <strong>Nota:</strong> por su valor crítico, la opción de eliminar solo se ejecuta desde el
          interior de la base de datos y no se habilita a través de este mantenedor. Para dejar de
          ofrecer una plataforma, se desactiva (estado Inactiva).
        </p>
      </div>

      {detalle && opcionDetalle && (
        <DetallePlataforma
          key={detalle.id}
          fila={detalle}
          opcion={opcionDetalle}
          historial={planes
            .filter((p) => p.plataforma_option_id === detalle.plataforma_option_id)
            .sort((a, b) => b.fecha_vigencia.localeCompare(a.fecha_vigencia))}
          plataformas={filas.map((f) => ({
            id: f.plataforma_option_id,
            nombre: opcionDe(f)?.nombre ?? "—",
            activo: opcionDe(f)?.activo ?? false,
          }))}
          onEditarNotas={() => {
            setEditandoNotas(detalle);
            setDetalle(null);
          }}
          onCerrar={() => setDetalle(null)}
        />
      )}

      {editandoNotas && opcionEditandoNotas && (
        <EditorNotas
          key={editandoNotas.id}
          fila={editandoNotas}
          opcion={opcionEditandoNotas}
          onCancelar={() => setEditandoNotas(null)}
          onTerminar={terminarOperacion}
        />
      )}

      {editando && opcionEditando && (
        <EditorPlan
          key={editando.id}
          fila={editando}
          opcion={opcionEditando}
          hayOtraActiva={filas.some(
            (f) => f.plataforma_option_id !== editando.plataforma_option_id && (opcionDe(f)?.activo ?? false)
          )}
          onCancelar={() => setEditando(null)}
          onTerminar={terminarOperacion}
        />
      )}

      {creando && (
        <NuevaPlataforma
          nombresExistentes={filas.map((f) => opcionDe(f)?.nombre ?? "")}
          onCancelar={() => setCreando(false)}
          onTerminar={terminarOperacion}
        />
      )}
    </main>
  );
}