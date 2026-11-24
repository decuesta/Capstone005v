// ============================================================
// app/components/ContactoAgencia.tsx
// Ventana para contactar a una agencia (RF-13, RF-24). Muestra el aviso
// de exención de responsabilidad, el aviso de acuerdo comercial cuando la
// agencia es afiliada, qué datos se comparten y exige aceptar.
// El registro lo hace la función registrar_contacto_agencia de la base,
// que vuelve a validar todo (sesión, consentimiento, que el diagnóstico
// sea de esta cuenta, que la agencia esté disponible y que no se repita).
// Antes de enviar se comprueba que la sesión siga viva: una sesión puede
// terminar mientras la ventana está abierta (por ejemplo, si se cierra la
// sesión en otra pestaña). En ese caso se avisa con palabras claras y se
// lleva a iniciar sesión de nuevo, en vez de mostrar un error técnico.
// Modelo MVP ("concierge"): el contacto se registra y el administrador lo
// hace llegar a la agencia; no hay envío automático.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";

export interface AgenciaDisponible {
  id: string;
  nombre: string;
  categoria_servicio: string;
  portafolio_url: string | null;
  es_demo: boolean;
  es_afiliado: boolean;
}

export const AVISO_EXENCION =
  "E-Match solo te conecta con agencias: no forma parte del acuerdo que establezcas con ellas ni responde por sus servicios, precios o resultados. Evalúa y compara antes de contratar.";

export const AVISO_AGENCIA_AFILIADA = "Esta agencia tiene un acuerdo comercial con E-Match.";

const MENSAJE_SESION_TERMINADA = "Tu sesión terminó. Inicia sesión de nuevo para contactar a la agencia.";

interface ContactoAgenciaProps {
  agencia: AgenciaDisponible;
  diagnosticoId: string;
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
  // Si se pasa, el aviso de sesión terminada ofrece volver a iniciar sesión.
  onIniciarSesion?: () => void;
}

export default function ContactoAgencia({
  agencia,
  diagnosticoId,
  onCancelar,
  onTerminar,
  onIniciarSesion,
}: ContactoAgenciaProps) {
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sesionTerminada, setSesionTerminada] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    if (!acepta) {
      setError("Marca la casilla para aceptar compartir tus datos.");
      return;
    }

    setEnviando(true);
    try {
      // La sesión puede haber terminado con la ventana abierta.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setSesionTerminada(true);
        return;
      }

      const { error: errorRpc } = await supabase.rpc("registrar_contacto_agencia", {
        p_diagnostico_id: diagnosticoId,
        p_agencia_id: agencia.id,
        p_acepta_compartir: true,
      });
      if (errorRpc) {
        // Un error de permisos significa casi siempre que la sesión se perdió
        // justo antes de enviar: se muestra el mensaje claro, no el técnico.
        if (errorRpc.code === "42501" || /permission denied/i.test(errorRpc.message)) {
          console.warn("Contacto con agencia: la sesión no tenía permiso.", errorRpc.message);
          setSesionTerminada(true);
          return;
        }
        console.warn("No se pudo registrar el contacto:", errorRpc.message);
        setError(`No se pudo registrar: ${errorRpc.message}`);
        return;
      }
      onTerminar(
        agencia.es_demo
          ? `Solicitud registrada para ${agencia.nombre}. Es una agencia de demostración: no se envió a nadie.`
          : `Solicitud registrada para ${agencia.nombre}. El equipo de E-Match la hará llegar a la agencia.`,
        "ok"
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-slate-900">Contactar a {agencia.nombre}</h2>

        {sesionTerminada ? (
          <>
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              {MENSAJE_SESION_TERMINADA}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onCancelar}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Cerrar
              </button>
              {onIniciarSesion && (
                <button
                  onClick={onIniciarSesion}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
                >
                  Iniciar sesión
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {agencia.es_demo && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                Agencia de demostración (ficticia): tu solicitud quedará registrada para probar el flujo, pero no se
                enviará a nadie.
              </p>
            )}

            <p className="text-sm text-slate-600">{AVISO_EXENCION}</p>

            {agencia.es_afiliado && (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                {AVISO_AGENCIA_AFILIADA}
              </p>
            )}

            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <strong>Qué se comparte:</strong> el correo de tu cuenta y los datos de tu diagnóstico (las respuestas que
              diste y las sugerencias).
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" />
              <span className="text-sm text-slate-700">
                Acepto compartir estos datos con {agencia.nombre} para que me contacte.
              </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                onClick={onCancelar}
                disabled={enviando}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={enviando}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
              >
                {enviando ? "Enviando..." : "Solicitar contacto"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}