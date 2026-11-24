// ============================================================
// app/admin/reglas/SeccionReglas.tsx
// Reglas de ajuste del motor (RF-17): lista legible agrupada por
// categoría y edición del valor del ajuste (entero de -20 a +20). La
// base solo permite a un administrador modificar la columna ajuste_peso
// y vuelve a comprobar el rango. No se crean ni se eliminan reglas desde
// aquí (límite del MVP). No guarda historial.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import {
  AJUSTE_MAX,
  AJUSTE_MIN,
  aNumero,
  formatoAjuste,
  textoCondicion,
  type Categoria,
  type CriterioFila,
  type Regla,
} from "./utilidades";

interface EditorReglaProps {
  regla: Regla;
  criterioNombre: string;
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

function EditorRegla({ regla, criterioNombre, onCancelar, onTerminar }: EditorReglaProps) {
  const actual = Number(regla.ajuste_peso);
  const [valor, setValor] = useState(String(actual));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);

    const nuevo = aNumero(valor);
    if (nuevo === null || !Number.isInteger(nuevo) || nuevo < AJUSTE_MIN || nuevo > AJUSTE_MAX) {
      setError(`El ajuste debe ser un número entero entre ${AJUSTE_MIN} y ${AJUSTE_MAX}.`);
      return;
    }
    if (nuevo === actual) {
      setError("No hay cambios para guardar.");
      return;
    }

    const confirmado = window.confirm(
      `${textoCondicion(regla.condicion)} → ${criterioNombre}\n\nAjuste: ${formatoAjuste(actual)} → ${formatoAjuste(nuevo)}\n\n` +
        `El cambio afecta a las recomendaciones de los diagnósticos nuevos desde ahora. Los ya guardados no cambian.\n` +
        `No se guarda historial: el valor anterior se pierde.\n\n¿Confirmas?`
    );
    if (!confirmado) return;

    setGuardando(true);
    try {
      const { data, error: errorUpdate } = await supabase
        .from("scoring_weight_rule")
        .update({ ajuste_peso: nuevo })
        .eq("id", regla.id)
        .select("id");
      if (errorUpdate) {
        console.error("Error al guardar la regla:", errorUpdate.message);
        setError(`No se pudo guardar: ${errorUpdate.message}`);
        return;
      }
      if (!data || data.length !== 1) {
        setError("La base no aceptó el cambio (revisa tu sesión y tus permisos).");
        return;
      }
      onTerminar(`Regla actualizada: ${textoCondicion(regla.condicion)} → ${criterioNombre} ${formatoAjuste(nuevo)}.`, "ok");
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
          <h2 className="text-xl font-bold text-slate-900">Editar regla</h2>
          <p className="text-sm text-slate-500">
            {textoCondicion(regla.condicion)} → {criterioNombre}
          </p>
        </div>

        <div>
          <label htmlFor="regla-ajuste" className="block text-sm font-semibold text-slate-700 mb-1">
            Ajuste (entero de {AJUSTE_MIN} a +{AJUSTE_MAX})
          </label>
          <input
            id="regla-ajuste"
            type="number"
            min={AJUSTE_MIN}
            max={AJUSTE_MAX}
            step={1}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl"
          />
          <p className="text-xs text-slate-500 mt-1">
            Cuando se cumple la condición, este valor se suma al peso base del criterio y el sistema vuelve a
            repartir los pesos para que sumen 100. Positivo: el criterio pesa más. Negativo: pesa menos.
          </p>
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
            {guardando ? "Guardando..." : "Guardar ajuste"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SeccionReglasProps {
  categorias: Categoria[];
  criterios: CriterioFila[];
  reglas: Regla[];
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

export default function SeccionReglas({ categorias, criterios, reglas, onTerminar }: SeccionReglasProps) {
  const [editando, setEditando] = useState<Regla | null>(null);
  const criterioPorId = new Map(criterios.map((c) => [c.id, c]));

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">Reglas de ajuste</h2>
        <p className="text-sm text-slate-500">
          Según las respuestas del diagnóstico, cada regla sube o baja el peso de un criterio. Aquí se edita solo el
          valor del ajuste.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {categorias.map((categoria) => {
          const delasCategoria = reglas
            .filter((r) => criterioPorId.get(r.criteria_id)?.categoria_id === categoria.id)
            .sort(
              (a, b) =>
                (criterioPorId.get(a.criteria_id)?.nombre ?? "").localeCompare(
                  criterioPorId.get(b.criteria_id)?.nombre ?? "",
                  "es"
                ) || textoCondicion(a.condicion).localeCompare(textoCondicion(b.condicion), "es")
            );
          return (
            <div key={categoria.id} className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                {categoria.nombre} ({delasCategoria.length} reglas)
              </h3>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Condición</th>
                    <th className="py-2 pr-4">Criterio</th>
                    <th className="py-2 pr-4">Ajuste</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {delasCategoria.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{textoCondicion(r.condicion)}</td>
                      <td className="py-2 pr-4">{criterioPorId.get(r.criteria_id)?.nombre ?? "—"}</td>
                      <td className="py-2 pr-4 font-semibold">{formatoAjuste(Number(r.ajuste_peso))}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setEditando(r)}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {editando && (
        <EditorRegla
          key={editando.id}
          regla={editando}
          criterioNombre={criterioPorId.get(editando.criteria_id)?.nombre ?? "—"}
          onCancelar={() => setEditando(null)}
          onTerminar={(texto, tipo) => {
            setEditando(null);
            onTerminar(texto, tipo);
          }}
        />
      )}
    </section>
  );
}