// ============================================================
// app/components/PlanPasoAPaso.tsx
// Pantalla "Plan paso a paso": después del diagnóstico, la persona puede
// pasar a la acción. Tres secciones: 1) plataformas (la sugerida primero y
// marcada, y las demás disponibles), 2) transportistas (igual) y 3)
// agencias (sin sugerencia ni puntaje, hasta 3, según la ruta).
// - Los botones de plataforma y transportista abren su sitio en una
//   ventana nueva y registran el clic contra el diagnóstico.
// - El aviso de comisión solo aparece en los enlaces marcados como
//   afiliados; el de acuerdo comercial, en las agencias marcadas.
// - Las agencias se muestran en orden aleatorio, estable para cada
//   diagnóstico: se mezclan con una semilla tomada del identificador del
//   diagnóstico, antes de limitar a 3. Así el orden no es una evaluación
//   y todas las agencias elegibles tienen una exposición parecida.
// - Contactar a una agencia exige cuenta (RF-13) y muestra el aviso de
//   exención (RF-24).
// - Ruta "aún no formal": en la sección de plataforma no hay enlaces, y las
//   agencias son las de asesoría de venta en redes (RF-26).
// Toda la lectura es pública salvo los contactos, que solo ve su dueño.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import type { ResultadoDiagnostico } from "@/app/actions/generateCanvas";
import ContactoAgencia, {
  AVISO_AGENCIA_AFILIADA,
  AVISO_EXENCION,
  type AgenciaDisponible,
} from "./ContactoAgencia";
import PorQueDarElPaso from "./PorQueDarElPaso";

interface CategoriaPublica {
  id: string;
  nombre: string;
}

interface OpcionPublica {
  id: string;
  categoria_id: string;
  nombre: string;
  enlace_afiliado: string | null;
  es_afiliado: boolean;
}

interface PlanPublico {
  plataforma_option_id: string;
  nombre_plan: string;
  precio_mensual_clp: number | string;
  comision_transaccion_pct: number | string;
  fecha_vigencia: string;
}

interface Sugerida {
  id?: string;
  nombre: string;
}

const AVISO_AFILIADO =
  "Enlace de afiliado: E-Match puede recibir una comisión si contratas, sin costo adicional para ti.";

const NOTA_ORDEN_AGENCIAS =
  "Las agencias se muestran en orden aleatorio, distinto para cada diagnóstico. El orden no es una evaluación ni una recomendación de E-Match.";

const ETIQUETA_CATEGORIA: Record<string, string> = {
  desarrollo_ecommerce: "Desarrollo de tienda online",
  asesoria_venta_social: "Asesoría de venta en redes",
  ambas: "Tienda online y redes",
};

// Solo se muestran enlaces https.
function enlaceSeguro(enlace: string | null | undefined): string | null {
  return typeof enlace === "string" && enlace.startsWith("https://") ? enlace : null;
}

function esSugerida(opcion: OpcionPublica, sugerida: Sugerida | null | undefined): boolean {
  if (!sugerida) return false;
  return sugerida.id ? opcion.id === sugerida.id : opcion.nombre === sugerida.nombre;
}

// La sugerida primero; el resto, en orden alfabético.
function ordenar(opciones: OpcionPublica[], sugerida: Sugerida | null | undefined): OpcionPublica[] {
  return [...opciones].sort(
    (a, b) =>
      Number(esSugerida(b, sugerida)) - Number(esSugerida(a, sugerida)) || a.nombre.localeCompare(b.nombre, "es")
  );
}

// Semilla numérica (FNV-1a de 32 bits) a partir de un texto.
function semillaDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Generador pseudoaleatorio con semilla (mulberry32): la misma semilla
// produce siempre la misma secuencia.
function generadorAleatorio(semilla: number): () => number {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mezcla imparcial (Fisher-Yates) con semilla. Devuelve una copia; la lista
// de entrada debe venir en un orden fijo (aquí, por nombre) para que la
// misma semilla dé siempre el mismo resultado.
function mezclar<T>(lista: T[], semilla: string): T[] {
  const copia = [...lista];
  const azar = generadorAleatorio(semillaDe(semilla));
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

interface PlanPasoAPasoProps {
  resultado: ResultadoDiagnostico;
  diagnosticoId?: string;
  usuarioId: string | null;
  onVolver: () => void;
  onIniciarSesion: () => void;
}

export default function PlanPasoAPaso({
  resultado,
  diagnosticoId,
  usuarioId,
  onVolver,
  onIniciarSesion,
}: PlanPasoAPasoProps) {
  const [plataformas, setPlataformas] = useState<OpcionPublica[]>([]);
  const [couriers, setCouriers] = useState<OpcionPublica[]>([]);
  const [planes, setPlanes] = useState<Map<string, PlanPublico>>(new Map());
  const [agencias, setAgencias] = useState<AgenciaDisponible[]>([]);
  const [contactadas, setContactadas] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [contactando, setContactando] = useState<AgenciaDisponible | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: "ok" | "error" } | null>(null);
  // Semilla de respaldo para el orden de las agencias, por si el diagnóstico
  // no trae identificador (no debería ocurrir): se fija al abrir la pantalla.
  const [semillaLocal] = useState(() => String(Math.random()));

  const idDiagnostico = diagnosticoId ?? resultado.diagnosticoId;
  const rutaInformal = resultado.sinRecomendacionPlataforma;
  // Servicios: sin despacho no hay sección de transportista.
  const sinTransportista = resultado.esServicio === true;

  // Carga lo público: plataformas, transportistas, planes y agencias.
  useEffect(() => {
    let montado = true;

    async function cargar() {
      const [rCat, rOpc, rPlanes, rAg] = await Promise.all([
        supabase.from("scoring_category").select("id, nombre"),
        supabase
          .from("scoring_option")
          .select("id, categoria_id, nombre, enlace_afiliado, es_afiliado")
          .eq("activo", true),
        supabase
          .from("planes_plataforma")
          .select("plataforma_option_id, nombre_plan, precio_mensual_clp, comision_transaccion_pct, fecha_vigencia"),
        supabase
          .from("agencias")
          .select("id, nombre, categoria_servicio, portafolio_url, es_demo, es_afiliado")
          .order("nombre"),
      ]);
      if (!montado) return;

      const fallo = rCat.error ?? rOpc.error ?? rPlanes.error ?? rAg.error;
      if (fallo) {
        console.error("No se pudo cargar el plan paso a paso:", fallo.message);
        setErrorCarga("No pudimos cargar las opciones. Intenta de nuevo más tarde.");
        setCargando(false);
        return;
      }

      const categorias = (rCat.data ?? []) as CategoriaPublica[];
      const idPlataformas = categorias.find((c) => c.nombre === "Plataformas E-Commerce")?.id;
      const idCouriers = categorias.find((c) => c.nombre === "Couriers y Logística")?.id;
      const opciones = (rOpc.data ?? []) as OpcionPublica[];
      setPlataformas(opciones.filter((o) => o.categoria_id === idPlataformas));
      setCouriers(opciones.filter((o) => o.categoria_id === idCouriers));

      // El plan vigente de cada plataforma es el de fecha más reciente.
      const vigentes = new Map<string, PlanPublico>();
      for (const p of (rPlanes.data ?? []) as PlanPublico[]) {
        const actual = vigentes.get(p.plataforma_option_id);
        if (!actual || p.fecha_vigencia > actual.fecha_vigencia) vigentes.set(p.plataforma_option_id, p);
      }
      setPlanes(vigentes);

      setAgencias((rAg.data ?? []) as AgenciaDisponible[]);
      setCargando(false);
    }
    cargar();

    return () => {
      montado = false;
    };
  }, []);

  // Con sesión: qué agencias ya se contactaron con este diagnóstico
  // (la base solo deja leer los contactos propios).
  useEffect(() => {
    if (!usuarioId || !idDiagnostico) {
      setContactadas(new Set());
      return;
    }
    let montado = true;
    supabase
      .from("contactos_agencia")
      .select("agencia_id")
      .eq("diagnostico_id", idDiagnostico)
      .then(({ data, error }) => {
        if (!montado) return;
        if (error) {
          console.error("No se pudieron leer los contactos:", error.message);
          return;
        }
        setContactadas(new Set((data ?? []).map((c) => c.agencia_id as string)));
      });
    return () => {
      montado = false;
    };
  }, [usuarioId, idDiagnostico]);

  // RF-20: deja registrado que este diagnóstico abrió el plan paso a paso.
  // Se cuenta una sola vez por diagnóstico (la base ignora los repetidos) y
  // si falla no afecta a la pantalla. Restaura lo agregado en PR23 y perdido en PR28.
  useEffect(() => {
    if (!idDiagnostico) return;
    supabase
      .rpc("registrar_evento_uso", { p_diagnostico_id: idDiagnostico, p_tipo: "paso_a_paso" })
      .then(({ error }) => {
        if (error) console.error("No se pudo registrar el uso del plan:", error.message);
      });
  }, [idDiagnostico]);

  // Registra el clic sin esperar la respuesta: el enlace se abre igual.
  function registrarClic(optionId: string) {
    if (!idDiagnostico) return;
    supabase
      .rpc("registrar_clic_afiliado", { p_diagnostico_id: idDiagnostico, p_option_id: optionId })
      .then(({ error }) => {
        if (error) console.error("No se pudo registrar el clic:", error.message);
      });
  }

  function terminarContacto(texto: string, tipo: "ok" | "error") {
    if (tipo === "ok" && contactando) {
      const id = contactando.id;
      setContactadas((prev) => new Set(prev).add(id));
    }
    setContactando(null);
    setMensaje({ texto, tipo });
  }

  // Las elegibles de la ruta, ya ordenadas por nombre (la consulta lo hace),
  // se mezclan con la semilla del diagnóstico y recién entonces se limita a 3.
  const elegibles = agencias.filter(
    (a) =>
      a.categoria_servicio === "ambas" ||
      a.categoria_servicio === (rutaInformal ? "asesoria_venta_social" : "desarrollo_ecommerce")
  );
  const agenciasRuta = mezclar(elegibles, idDiagnostico ?? semillaLocal).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onVolver} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
          ← Volver al resultado
        </button>
        <h2 className="text-2xl font-bold text-slate-900 mt-2">Plan paso a paso</h2>
        <p className="text-sm text-slate-500">
          {sinTransportista
            ? "Elige tu plataforma y, si quieres apoyo, una agencia. Puedes saltarte cualquier paso."
            : "Elige tu plataforma, tu transportista y, si quieres apoyo, una agencia. Puedes saltarte cualquier paso."}
        </p>
      </div>

      {mensaje && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            mensaje.tipo === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <PorQueDarElPaso resultado={resultado} />

      {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
      {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

      {!cargando && !errorCarga && (
        <>
          {/* 1. Plataforma */}
          <section className="space-y-3">
            <h3 className="font-semibold">1. Plataforma</h3>
            {rutaInformal ? (
              <div className="rounded-lg border p-4 bg-amber-50">
                <p className="text-sm text-gray-700">
                  Por tu etapa y presupuesto, te sugerimos partir con WhatsApp Business o Instagram Shopping, sin
                  una plataforma formal todavía. Cuando tu negocio esté listo para una tienda online, haz un nuevo
                  diagnóstico.
                </p>
              </div>
            ) : (
              ordenar(plataformas, resultado.plataforma).map((p) => {
                const sugerida = esSugerida(p, resultado.plataforma);
                const plan = planes.get(p.id);
                const enlace = enlaceSeguro(p.enlace_afiliado);
                return (
                  <div key={p.id} className={`rounded-lg border p-4 ${sugerida ? "border-blue-300 bg-blue-50" : ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg">{p.nombre}</p>
                      {sugerida && (
                        <span className="text-xs font-semibold text-blue-700">Sugerida por tu diagnóstico</span>
                      )}
                    </div>
                    {plan && (
                      <p className="text-sm text-gray-600">
                        Plan {plan.nombre_plan}: ${Number(plan.precio_mensual_clp).toLocaleString("es-CL")} al mes ·
                        comisión {Number(plan.comision_transaccion_pct)}%
                      </p>
                    )}
                    {enlace && (
                      <div className="mt-3 space-y-1">
                        <a
                          href={enlace}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => registrarClic(p.id)}
                          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
                        >
                          Ir a {p.nombre} y crear mi cuenta
                        </a>
                        {p.es_afiliado && <p className="text-xs text-gray-500">{AVISO_AFILIADO}</p>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {!rutaInformal && (
              <p className="text-xs text-gray-500">
                Los precios son referenciales: confírmalos en el sitio de cada plataforma.
              </p>
            )}
          </section>

          {/* 2. Transportista (no aplica a servicios) */}
          {!sinTransportista && (
          <section className="space-y-3">
            <h3 className="font-semibold">2. Transportista</h3>
            {ordenar(couriers, resultado.courier).map((c) => {
              const sugerida = esSugerida(c, resultado.courier);
              const enlace = enlaceSeguro(c.enlace_afiliado);
              return (
                <div key={c.id} className={`rounded-lg border p-4 ${sugerida ? "border-blue-300 bg-blue-50" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg">{c.nombre}</p>
                    {sugerida && <span className="text-xs font-semibold text-blue-700">Sugerido por tu diagnóstico</span>}
                  </div>
                  {enlace && (
                    <div className="mt-3 space-y-1">
                      <a
                        href={enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => registrarClic(c.id)}
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
                      >
                        Conocer cómo contratar con {c.nombre}
                      </a>
                      {c.es_afiliado && <p className="text-xs text-gray-500">{AVISO_AFILIADO}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
          )}

          {/* 3. Agencias (2 si no hay sección de transportista) */}
          <section className="space-y-3">
            <h3 className="font-semibold">{sinTransportista ? "2" : "3"}. Agencias</h3>
            <p className="text-sm text-gray-600">
              {rutaInformal
                ? "Agencias de asesoría de venta en redes, para partir con tus canales actuales."
                : "Agencias que pueden ayudarte a armar tu tienda online."}
            </p>
            <p className="text-xs text-gray-600 bg-gray-50 border rounded-lg p-3">{AVISO_EXENCION}</p>
            <p className="text-xs text-gray-600 bg-gray-50 border rounded-lg p-3">{NOTA_ORDEN_AGENCIAS}</p>

            {agenciasRuta.length === 0 && (
              <p className="text-sm text-gray-500">No hay agencias disponibles por ahora.</p>
            )}

            {agenciasRuta.map((a) => {
              const portafolio = enlaceSeguro(a.portafolio_url);
              const yaContactada = contactadas.has(a.id);
              return (
                <div key={a.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg">{a.nombre}</p>
                    {a.es_demo && <span className="text-xs font-semibold text-amber-700">Demostración</span>}
                  </div>
                  <p className="text-sm text-gray-600">
                    {ETIQUETA_CATEGORIA[a.categoria_servicio] ?? a.categoria_servicio}
                  </p>
                  {a.es_demo && (
                    <p className="text-xs text-gray-500">Agencia ficticia, solo para probar el flujo.</p>
                  )}
                  {a.es_afiliado && <p className="text-xs text-gray-500">{AVISO_AGENCIA_AFILIADA}</p>}
                  <div className="mt-3 flex items-center gap-4">
                    {yaContactada ? (
                      <span className="text-sm font-semibold text-green-700">Solicitud registrada</span>
                    ) : !usuarioId ? (
                      <button
                        onClick={onIniciarSesion}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl"
                      >
                        Inicia sesión para contactar
                      </button>
                    ) : !idDiagnostico ? (
                      <span className="text-xs text-gray-500">No disponible para este diagnóstico.</span>
                    ) : (
                      <button
                        onClick={() => {
                          setMensaje(null);
                          setContactando(a);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
                      >
                        Contactar
                      </button>
                    )}
                    {portafolio && (
                      <a
                        href={portafolio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-slate-600 hover:text-slate-900 underline"
                      >
                        Ver portafolio
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}

      {contactando && idDiagnostico && (
        <ContactoAgencia
          key={contactando.id}
          agencia={contactando}
          diagnosticoId={idDiagnostico}
          onCancelar={() => setContactando(null)}
          onTerminar={terminarContacto}
          onIniciarSesion={() => {
            setContactando(null);
            onIniciarSesion();
          }}
        />
      )}
    </div>
  );
}
