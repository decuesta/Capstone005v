// ============================================================
// app/components/MisDiagnosticos.tsx
// Lista los diagnósticos finalizados del usuario con sesión y permite
// ver cada uno tal como se mostró al terminarlo (usa la columna
// resultado, no recalcula nada). Desde cada diagnóstico se puede abrir
// el "Plan paso a paso", incluso en los guardados antes de que existiera
// (el contacto y los clics usan el identificador de la base de datos).
// También permite eliminar un diagnóstico (derecho de supresión, RNF-05):
// la función eliminar_diagnostico de la base borra el contenido personal
// y desvincula el registro de la cuenta. No se puede deshacer.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import CanvasReport from "./CanvasReport";
import PlanPasoAPaso from "./PlanPasoAPaso";
import type { ResultadoDiagnostico } from "@/app/actions/generateCanvas";

interface DiagnosticoGuardado {
  id: string;
  fecha_creacion: string;
  resultado: ResultadoDiagnostico;
}

interface MisDiagnosticosProps {
  usuarioId: string;
  onVolver: () => void;
}

interface MensajeEliminar {
  tipo: "ok" | "error";
  texto: string;
}

export default function MisDiagnosticos({ usuarioId, onVolver }: MisDiagnosticosProps) {
  const [lista, setLista] = useState<DiagnosticoGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<DiagnosticoGuardado | null>(null);
  const [verPlan, setVerPlan] = useState(false);
  // Eliminación: id que espera confirmación, id que se está eliminando y resultado.
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [mensajeEliminar, setMensajeEliminar] = useState<MensajeEliminar | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data, error: errorConsulta } = await supabase
        .from("diagnosticos")
        .select("id, fecha_creacion, resultado")
        .eq("usuario_id", usuarioId)
        .eq("estado", "completo")
        .not("resultado", "is", null)
        .order("fecha_creacion", { ascending: false });

      if (errorConsulta) {
        setError("No pudimos cargar tus diagnósticos. Intenta de nuevo más tarde.");
        console.error("Error cargando diagnósticos:", errorConsulta.message);
      } else {
        setLista((data ?? []) as DiagnosticoGuardado[]);
      }
      setCargando(false);
    }
    cargar();
  }, [usuarioId]);

  // Elimina (anonimiza) un diagnóstico. La base verifica que sea del usuario.
  async function eliminarDiagnostico(id: string) {
    setEliminandoId(id);
    setMensajeEliminar(null);

    const { data, error: errorRpc } = await supabase.rpc("eliminar_diagnostico", {
      p_diagnostico_id: id,
    });

    if (errorRpc) {
      console.error("Error eliminando diagnóstico:", errorRpc.message);
      setMensajeEliminar({
        tipo: "error",
        texto: "No pudimos eliminar el diagnóstico. Intenta de nuevo más tarde.",
      });
    } else if (data === true) {
      setLista((anterior) => anterior.filter((d) => d.id !== id));
      setMensajeEliminar({ tipo: "ok", texto: "Diagnóstico eliminado." });
    } else {
      setMensajeEliminar({
        tipo: "error",
        texto: "No encontramos ese diagnóstico entre los tuyos, o ya fue eliminado.",
      });
    }

    setConfirmandoId(null);
    setEliminandoId(null);
  }

  // Plan paso a paso de un diagnóstico guardado. La persona ya tiene
  // sesión, así que no hace falta el botón de iniciar sesión.
  if (seleccionado && verPlan) {
    return (
      <div className="max-w-2xl w-full">
        <PlanPasoAPaso
          resultado={seleccionado.resultado}
          diagnosticoId={seleccionado.id}
          usuarioId={usuarioId}
          onVolver={() => setVerPlan(false)}
          onIniciarSesion={() => {}}
        />
      </div>
    );
  }

  // Vista de detalle: un diagnóstico guardado, con el mismo componente
  // que se usa al terminar el wizard (incluye el botón de PDF).
  if (seleccionado) {
    return (
      <div className="max-w-2xl w-full space-y-6">
        <button
          onClick={() => {
            setVerPlan(false);
            setSeleccionado(null);
          }}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          ← Volver a mis diagnósticos
        </button>
        <CanvasReport
          resultado={seleccionado.resultado}
          diagnosticoId={seleccionado.id}
          onPlanPasoAPaso={() => setVerPlan(true)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Mis diagnósticos</h2>

      {cargando && <p className="text-sm text-slate-500">Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {mensajeEliminar && (
        <p className={`text-sm ${mensajeEliminar.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>
          {mensajeEliminar.texto}
        </p>
      )}

      {!cargando && !error && lista.length === 0 && (
        <p className="text-sm text-slate-500">
          Todavía no tienes diagnósticos finalizados. Cuando hagas uno, aparecerá aquí.
        </p>
      )}

      <div className="space-y-3">
        {lista.map((d) => (
          <div key={d.id} className="space-y-2">
            <div className="flex items-stretch gap-2">
              <button
                onClick={() => setSeleccionado(d)}
                className="flex-1 text-left p-4 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all"
              >
                <p className="text-xs text-slate-400">
                  {new Date(d.fecha_creacion).toLocaleString("es-CL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </p>
                <p className="font-semibold text-slate-800">
                  {d.resultado.plataforma?.nombre ?? "Sin plataforma formal"}
                  {d.resultado.courier ? ` + ${d.resultado.courier.nombre}` : ""}
                </p>
              </button>
              <button
                onClick={() => {
                  setMensajeEliminar(null);
                  setConfirmandoId(d.id);
                }}
                disabled={eliminandoId !== null}
                aria-label="Eliminar diagnóstico"
                className="px-3 text-sm font-semibold text-slate-400 border border-slate-200 rounded-xl hover:text-red-600 hover:border-red-300 transition-all disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>

            {confirmandoId === d.id && (
              <div className="p-4 border border-red-200 bg-red-50 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-slate-800">¿Eliminar este diagnóstico?</p>
                <p className="text-sm text-slate-600">
                  Se borrarán tu informe y tus recomendaciones, y el diagnóstico dejará de estar asociado a tu
                  cuenta. Esta acción no se puede deshacer. Si ya pediste que una agencia te contactara a
                  través del sistema, esa agencia conserva la información que recibió.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => eliminarDiagnostico(d.id)}
                    disabled={eliminandoId !== null}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {eliminandoId === d.id ? "Eliminando..." : "Sí, eliminar definitivamente"}
                  </button>
                  <button
                    onClick={() => setConfirmandoId(null)}
                    disabled={eliminandoId !== null}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={onVolver} className="text-sm text-slate-400 hover:text-slate-600 w-full text-center">
        Volver
      </button>
    </div>
  );
}
