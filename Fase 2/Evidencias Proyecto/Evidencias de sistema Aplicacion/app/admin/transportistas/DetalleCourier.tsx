// ============================================================
// app/admin/transportistas/DetalleCourier.tsx
// Detalle de un transportista, de solo lectura (ventana superpuesta):
// notas por criterio, puntaje base y comparación con los demás.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { normalizarNotas, puntajeBase, type Courier, type FilaNota, type NotaCriterio } from "./utilidades";

interface DetalleCourierProps {
  courier: Courier;
  cantidadTarifas: number;
  couriers: Courier[];
  onCerrar: () => void;
}

export default function DetalleCourier({ courier, cantidadTarifas, couriers, onCerrar }: DetalleCourierProps) {
  const [notas, setNotas] = useState<NotaCriterio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clave estable para el efecto: evita volver a pedir las notas si el
  // padre vuelve a crear la lista con el mismo contenido.
  const claveIds = couriers.map((c) => c.id).join(",");

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

  const notasDeEste = notas
    .filter((n) => n.optionId === courier.id)
    .sort((a, b) => b.peso - a.peso || a.nombre.localeCompare(b.nombre, "es"));
  const puntajeEste = puntajeBase(notasDeEste);

  const ranking = couriers
    .map((c) => ({ ...c, puntaje: puntajeBase(notas.filter((n) => n.optionId === c.id)) }))
    .sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1) || a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Detalle de {courier.nombre}</h2>
            <p className="text-sm text-slate-500">Solo lectura · {cantidadTarifas} tarifas cargadas.</p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              courier.activo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {courier.activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Notas por criterio</h3>
          {cargando && <p className="text-sm text-slate-500">Cargando notas...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!cargando && !error && notasDeEste.length === 0 && (
            <p className="text-sm text-slate-500">Este transportista no tiene notas cargadas.</p>
          )}
          {!cargando && !error && notasDeEste.length > 0 && (
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
                  {notasDeEste.map((n) => (
                    <tr key={n.criterioId} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{n.nombre}</td>
                      <td className="py-2 pr-4">{n.peso}%</td>
                      <td className="py-2 font-semibold">{n.nota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-slate-700">
                <strong>Puntaje base:</strong> {puntajeEste === null ? "—" : `${puntajeEste.toFixed(1)}/100`}
              </p>
            </>
          )}
        </section>

        {!cargando && !error && (
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900">Comparación con los demás transportistas</h3>
            <ul className="space-y-2">
              {ranking.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                    c.id === courier.id ? "bg-blue-50 border border-blue-200" : "border border-slate-100"
                  }`}
                >
                  <span className="font-semibold text-slate-800">
                    {c.nombre}{" "}
                    <span className="font-normal text-xs text-slate-500">({c.activo ? "Activo" : "Inactivo"})</span>
                  </span>
                  <span className="text-slate-700">
                    {c.puntaje === null ? "Sin notas" : `${c.puntaje.toFixed(1)}/100`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
              El puntaje base usa los pesos base de los criterios, sin las reglas de ajuste que aplica el
              sistema según las respuestas de cada diagnóstico. No es el puntaje que verá una persona: sirve
              para comparar transportistas entre sí.
            </p>
          </section>
        )}

        <p className="text-xs text-slate-500">
          Las notas de los transportistas son de solo lectura en esta etapa. La nota de "Costo del envío" se
          calculó con las tarifas de Santiago hasta 3 kg: si los precios cambian mucho, conviene revisarla.
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