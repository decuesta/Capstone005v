// ============================================================
// app/admin/transportistas/EditorTarifa.tsx
// Edición de una tarifa: precio y fecha de vigencia (ventana
// superpuesta). Se guarda en el lugar, sin historial (decisión solo del
// MVP). La base solo permite modificar estas dos columnas, y solo a un
// administrador; esta ventana valida lo mismo antes de enviar.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { aNumero, fechaCL, fechaValida, hoyISO, pesos, type Tarifa } from "./utilidades";

interface EditorTarifaProps {
  fila: Tarifa;
  nombreCourier: string;
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

export default function EditorTarifa({ fila, nombreCourier, onCancelar, onTerminar }: EditorTarifaProps) {
  const hoy = hoyISO();
  const [precio, setPrecio] = useState(String(Number(fila.tarifa)));
  const [fecha, setFecha] = useState(fila.fecha_vigencia);
  const [fechaTocada, setFechaTocada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);

    // 1) Validaciones (la base las vuelve a comprobar).
    const precioNuevo = aNumero(precio);
    if (precioNuevo === null || !Number.isInteger(precioNuevo) || precioNuevo < 0) {
      setError("El precio debe ser un número entero en pesos, mayor o igual a 0.");
      return;
    }
    if (!fechaValida(fecha)) {
      setError("La fecha de vigencia no es válida.");
      return;
    }
    if (fecha > hoy) {
      setError("La fecha de vigencia no puede ser futura.");
      return;
    }

    // 2) ¿Qué cambió?
    const precioActual = Number(fila.tarifa);
    const cambioPrecio = precioNuevo !== precioActual;
    const cambioFecha = fecha !== fila.fecha_vigencia;
    if (!cambioPrecio && !cambioFecha) {
      setError("No hay cambios para guardar.");
      return;
    }

    // 3) Confirmación con el resumen de lo que cambia.
    const lineas: string[] = [];
    if (cambioPrecio) lineas.push(`Precio: ${pesos(precioActual)} → ${pesos(precioNuevo)}`);
    if (cambioFecha) lineas.push(`Fecha de vigencia: ${fechaCL(fila.fecha_vigencia)} → ${fechaCL(fecha)}`);
    const confirmado = window.confirm(
      `${nombreCourier} · ${fila.servicio} · ${fila.zona_destino} · ${fila.quiebre_peso}\n\n${lineas.join("\n")}\n\n` +
        `Se guarda en el lugar, sin historial: el valor anterior se pierde.\n` +
        `Estos cambios afectan a los diagnósticos nuevos. ¿Confirmas?`
    );
    if (!confirmado) return;

    // 4) Escritura: solo las columnas que cambiaron.
    const cambios: { tarifa?: number; fecha_vigencia?: string } = {};
    if (cambioPrecio) cambios.tarifa = precioNuevo;
    if (cambioFecha) cambios.fecha_vigencia = fecha;

    setGuardando(true);
    try {
      const { data, error: errorUpdate } = await supabase
        .from("tarifas_transporte")
        .update(cambios)
        .eq("id", fila.id)
        .select("id");
      if (errorUpdate) {
        console.error("Error al guardar la tarifa:", errorUpdate.message);
        setError(`No se pudo guardar: ${errorUpdate.message}`);
        return;
      }
      if (!data || data.length !== 1) {
        setError("La base no aceptó el cambio (revisa tu sesión y tus permisos).");
        return;
      }
      onTerminar(
        `Tarifa actualizada: ${nombreCourier} · ${fila.servicio} · ${fila.zona_destino} · ${fila.quiebre_peso}.`,
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
          <h2 className="text-xl font-bold text-slate-900">Editar tarifa</h2>
          <p className="text-sm text-slate-500">
            {nombreCourier} · {fila.servicio} · destino {fila.zona_destino} · tramo {fila.quiebre_peso} · origen{" "}
            {fila.zona_origen}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="tarifa-precio" className="block text-sm font-semibold text-slate-700 mb-1">
              Precio (CLP, con IVA)
            </label>
            <input
              id="tarifa-precio"
              type="number"
              min={0}
              step={1}
              value={precio}
              onChange={(e) => {
                setPrecio(e.target.value);
                // Si cambia el precio y no se tocó la fecha, se propone la
                // de hoy (la del tarifario consultado); se puede corregir.
                if (!fechaTocada) setFecha(hoy);
              }}
              className="w-full p-3 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="tarifa-fecha" className="block text-sm font-semibold text-slate-700 mb-1">
              Fecha de vigencia
            </label>
            <input
              id="tarifa-fecha"
              type="date"
              max={hoy}
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setFechaTocada(true);
              }}
              className="w-full p-3 border border-slate-200 rounded-xl"
            />
            <p className="text-xs text-slate-500 mt-1">
              Es la fecha que ve la persona en "Tarifario vigente al...". Si cambias el precio, se propone la
              de hoy; usa la fecha del tarifario que consultaste. No puede ser futura.
            </p>
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