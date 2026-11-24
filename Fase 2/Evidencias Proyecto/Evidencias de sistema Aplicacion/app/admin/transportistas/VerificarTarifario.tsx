// ============================================================
// app/admin/transportistas/VerificarTarifario.tsx
// "Marcar tarifario verificado": renueva la fecha de vigencia de TODAS
// las tarifas de un transportista, sin cambiar precios. Exige declarar
// que se revisó el tarifario oficial, porque esa fecha es la que ve la
// persona en "Tarifario vigente al...".
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { fechaCL, fechaValida, hoyISO, type Courier, type Tarifa } from "./utilidades";

interface VerificarTarifarioProps {
  courier: Courier;
  tarifasCourier: Tarifa[];
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

export default function VerificarTarifario({
  courier,
  tarifasCourier,
  onCancelar,
  onTerminar,
}: VerificarTarifarioProps) {
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [declaracion, setDeclaracion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const total = tarifasCourier.length;
  const fechaMasReciente = tarifasCourier.reduce(
    (max, t) => (t.fecha_vigencia > max ? t.fecha_vigencia : max),
    ""
  );

  async function guardar() {
    setError(null);

    if (total === 0) {
      setError("Este transportista no tiene tarifas cargadas.");
      return;
    }
    if (!fechaValida(fecha)) {
      setError("La fecha no es válida.");
      return;
    }
    if (fecha > hoy) {
      setError("La fecha no puede ser futura.");
      return;
    }
    if (!declaracion) {
      setError("Marca la casilla para confirmar que revisaste el tarifario oficial.");
      return;
    }
    if (tarifasCourier.every((t) => t.fecha_vigencia === fecha)) {
      setError("Todas las tarifas de este transportista ya tienen esa fecha.");
      return;
    }

    const avisoRetroceso =
      fechaMasReciente > fecha
        ? `\n\nOjo: hay tarifas con una fecha más reciente (${fechaCL(fechaMasReciente)}). Todas quedarán con la fecha elegida.`
        : "";
    const confirmado = window.confirm(
      `Se renovará la fecha de vigencia de las ${total} tarifas de ${courier.nombre} a ${fechaCL(fecha)}.\n` +
        `No cambia ningún precio.${avisoRetroceso}\n\n` +
        `Esta es la fecha que verán las personas en "Tarifario vigente al...". ¿Confirmas?`
    );
    if (!confirmado) return;

    setGuardando(true);
    try {
      const { data, error: errorUpdate } = await supabase
        .from("tarifas_transporte")
        .update({ fecha_vigencia: fecha })
        .eq("courier_option_id", courier.id)
        .select("id");
      if (errorUpdate) {
        console.error("Error al marcar el tarifario como verificado:", errorUpdate.message);
        setError(`No se pudo guardar: ${errorUpdate.message}`);
        return;
      }
      const actualizadas = data?.length ?? 0;
      if (actualizadas !== total) {
        onTerminar(
          `Se actualizaron ${actualizadas} de ${total} tarifas de ${courier.nombre}. Revisa la tabla y vuelve a intentarlo.`,
          "error"
        );
        return;
      }
      onTerminar(
        `Tarifario de ${courier.nombre} marcado como verificado al ${fechaCL(fecha)} (${total} tarifas).`,
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Marcar tarifario verificado</h2>
          <p className="text-sm text-slate-500">
            {courier.nombre} · se renueva la fecha de sus {total} tarifas, sin cambiar precios.
          </p>
        </div>

        <div>
          <label htmlFor="verif-fecha" className="block text-sm font-semibold text-slate-700 mb-1">
            Fecha de verificación
          </label>
          <input
            id="verif-fecha"
            type="date"
            max={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl"
          />
          <p className="text-xs text-slate-500 mt-1">Hoy por defecto. No puede ser futura.</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={declaracion}
            onChange={(e) => setDeclaracion(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-slate-700">
            Revisé el tarifario oficial de este transportista y los precios siguen vigentes.
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
            {guardando ? "Guardando..." : "Marcar verificado"}
          </button>
        </div>
      </div>
    </div>
  );
}