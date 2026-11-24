// ============================================================
// app/admin/transportistas/EditorEnlace.tsx
// Edición del enlace de un transportista y de la casilla "es afiliado"
// (ventana superpuesta). El enlace es el que muestra el botón "Conocer
// cómo contratar" del resultado; con la casilla marcada, debajo del botón
// aparece el aviso de que E-Match puede recibir una comisión. Los
// diagnósticos ya guardados conservan el enlace que tenían.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { enlaceValido, type Courier } from "./utilidades";

interface EditorEnlaceProps {
  courier: Courier;
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

export default function EditorEnlace({ courier, onCancelar, onTerminar }: EditorEnlaceProps) {
  const [enlace, setEnlace] = useState(courier.enlace_afiliado ?? "");
  const [esAfiliado, setEsAfiliado] = useState(courier.es_afiliado);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);

    const enlaceNuevo = enlace.trim();
    if (!enlaceValido(enlaceNuevo)) {
      setError("El enlace debe comenzar con https:// y ser una dirección válida.");
      return;
    }

    const enlaceActual = courier.enlace_afiliado ?? "";
    const cambioEnlace = enlaceNuevo !== enlaceActual;
    const cambioAfiliado = esAfiliado !== courier.es_afiliado;
    if (!cambioEnlace && !cambioAfiliado) {
      setError("No hay cambios para guardar.");
      return;
    }

    const lineas: string[] = [];
    if (cambioEnlace) lineas.push(`Enlace: ${enlaceActual || "sin enlace"} → ${enlaceNuevo}`);
    if (cambioAfiliado) {
      lineas.push(`Enlace de afiliado (aviso de comisión): ${courier.es_afiliado ? "Sí" : "No"} → ${esAfiliado ? "Sí" : "No"}`);
    }
    const confirmado = window.confirm(
      `Enlace de ${courier.nombre}:\n\n${lineas.join("\n")}\n\n` +
        (esAfiliado
          ? "Con la casilla marcada, debajo del botón se mostrará el aviso de que E-Match puede recibir una comisión.\n\n"
          : "") +
        `Los diagnósticos ya guardados conservan el enlace que tenían. ¿Confirmas?`
    );
    if (!confirmado) return;

    setGuardando(true);
    try {
      const { data, error: errorUpdate } = await supabase
        .from("scoring_option")
        .update({ enlace_afiliado: enlaceNuevo, es_afiliado: esAfiliado })
        .eq("id", courier.id)
        .select("id");
      if (errorUpdate) {
        console.error("Error al guardar el enlace:", errorUpdate.message);
        setError(`No se pudo guardar: ${errorUpdate.message}`);
        return;
      }
      if (!data || data.length !== 1) {
        setError("La base no aceptó el cambio (revisa tu sesión y tus permisos).");
        return;
      }
      onTerminar(`Enlace de ${courier.nombre} actualizado.`, "ok");
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Enlace de {courier.nombre}</h2>
          <p className="text-sm text-slate-500">Es el enlace del botón "Conocer cómo contratar" del resultado.</p>
        </div>

        <div>
          <label htmlFor="courier-enlace" className="block text-sm font-semibold text-slate-700 mb-1">
            Enlace
          </label>
          <input
            id="courier-enlace"
            type="text"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://..."
            className="w-full p-3 border border-slate-200 rounded-xl"
          />
          <p className="text-xs text-slate-500 mt-1">Debe comenzar con https://.</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={esAfiliado}
            onChange={(e) => setEsAfiliado(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-slate-700">
            Este enlace es de afiliado (E-Match puede recibir una comisión). Márcala solo si es el enlace que
            entrega un programa de afiliados.
          </span>
        </label>

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
            {guardando ? "Guardando..." : "Guardar enlace"}
          </button>
        </div>
      </div>
    </div>
  );
}