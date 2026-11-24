// ============================================================
// app/admin/reglas/SeccionPesos.tsx
// Pesos base de los criterios del motor (RF-17). Se editan todos los
// pesos de una categoría a la vez: deben ser enteros de 0 a 100 y sumar
// exactamente 100. Se guardan con la función actualizar_pesos_categoria
// de la base (una sola transacción; si algo falla, no cambia ningún
// peso). No guarda historial: el peso nuevo sobrescribe el anterior
// (decisión solo del MVP).
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { aNumero, puntajeBase, type Categoria, type CriterioFila, type Nota, type Opcion } from "./utilidades";

interface SeccionPesosProps {
  categorias: Categoria[];
  criterios: CriterioFila[];
  opciones: Opcion[];
  notas: Nota[];
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

export default function SeccionPesos({ categorias, criterios, opciones, notas, onTerminar }: SeccionPesosProps) {
  const [categoriaId, setCategoriaId] = useState<string>(categorias[0]?.id ?? "");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const categoria = categorias.find((c) => c.id === categoriaId) ?? null;
  const criteriosCat = criterios
    .filter((c) => c.categoria_id === categoriaId)
    .sort((a, b) => Number(b.peso_base) - Number(a.peso_base) || a.nombre.localeCompare(b.nombre, "es"));
  const pesosActuales: Record<string, number> = {};
  for (const c of criteriosCat) pesosActuales[c.id] = Number(c.peso_base);

  // El formulario se reinicia al cambiar de categoría y cuando se
  // recargan los pesos guardados.
  const clavePesos = criteriosCat.map((c) => `${c.id}:${c.peso_base}`).join("|");
  useEffect(() => {
    const inicial: Record<string, string> = {};
    for (const c of criteriosCat) inicial[c.id] = String(Number(c.peso_base));
    setValores(inicial);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavePesos]);

  // Valores escritos, ya convertidos: cada peso debe ser un entero de 0 a 100.
  const nuevos: Record<string, number> = {};
  let todosValidos = criteriosCat.length > 0;
  for (const c of criteriosCat) {
    const n = aNumero(valores[c.id] ?? "");
    if (n === null || !Number.isInteger(n) || n < 0 || n > 100) {
      todosValidos = false;
      continue;
    }
    nuevos[c.id] = n;
  }
  const suma = Object.values(nuevos).reduce((a, b) => a + b, 0);
  const cambiados = criteriosCat.filter((c) => nuevos[c.id] !== undefined && nuevos[c.id] !== pesosActuales[c.id]);
  const sumaCorrecta = todosValidos && suma === 100;
  const puedeGuardar = sumaCorrecta && cambiados.length > 0 && !guardando;

  async function guardar() {
    if (!categoria || !puedeGuardar) return;
    setError(null);

    // Confirmación: los pesos que cambian y el puntaje base de cada opción.
    const opcionesCat = opciones
      .filter((o) => o.categoria_id === categoriaId)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    const f = (v: number | null) => (v === null ? "—" : v.toFixed(1));
    const lineasPesos = cambiados.map((c) => `  ${c.nombre}: ${pesosActuales[c.id]} → ${nuevos[c.id]}`).join("\n");
    const lineasPuntaje = opcionesCat
      .map((o) => {
        const notasOpcion = notas.filter((n) => n.option_id === o.id);
        return `  ${o.nombre}${o.activo ? "" : " (inactiva)"}: ${f(puntajeBase(notasOpcion, pesosActuales))} → ${f(
          puntajeBase(notasOpcion, nuevos)
        )}`;
      })
      .join("\n");
    const confirmado = window.confirm(
      `Pesos de ${categoria.nombre}:\n\n${lineasPesos}\n\nPuntaje base (sin reglas de ajuste):\n${lineasPuntaje}\n\n` +
        `El cambio afecta a las recomendaciones de los diagnósticos nuevos desde ahora. Los ya guardados no cambian.\n` +
        `No se guarda historial: el peso anterior se pierde.\n\n¿Confirmas?`
    );
    if (!confirmado) return;

    setGuardando(true);
    try {
      const { data, error: errorRpc } = await supabase.rpc("actualizar_pesos_categoria", {
        p_categoria_id: categoriaId,
        p_pesos: criteriosCat.map((c) => ({ criteria_id: c.id, peso_base: nuevos[c.id] })),
      });
      if (errorRpc) {
        console.error("Error al actualizar los pesos:", errorRpc.message);
        setError(`No se pudo guardar: ${errorRpc.message}`);
        return;
      }
      const cantidad = Number(data ?? 0);
      onTerminar(
        cantidad === 0
          ? `Los pesos de ${categoria.nombre} ya tenían esos valores: no se cambió nada.`
          : `Pesos de ${categoria.nombre} actualizados (${cantidad} ${cantidad === 1 ? "cambiado" : "cambiados"}).`,
        "ok"
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Pesos de los criterios</h2>
          <p className="text-sm text-slate-500">
            Importancia base de cada criterio. En cada categoría deben sumar exactamente 100.
          </p>
        </div>
        <div className="flex gap-2">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                c.id === categoriaId ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4">Criterio</th>
              <th className="py-2 pr-4">Peso actual</th>
              <th className="py-2">Peso nuevo</th>
            </tr>
          </thead>
          <tbody>
            {criteriosCat.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-2 pr-4">{c.nombre}</td>
                <td className="py-2 pr-4">{pesosActuales[c.id]}</td>
                <td className="py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={valores[c.id] ?? ""}
                    onChange={(e) => setValores((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    className="w-24 p-2 border border-slate-200 rounded-xl"
                  />
                  {nuevos[c.id] !== undefined && nuevos[c.id] !== pesosActuales[c.id] && (
                    <span className="ml-2 text-xs font-semibold text-blue-600">cambiado</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className={`text-sm font-semibold ${sumaCorrecta ? "text-green-700" : "text-red-600"}`}>
          Suma: {suma}{" "}
          {sumaCorrecta
            ? "(correcto)"
            : todosValidos
              ? "(deben sumar 100)"
              : "(cada peso debe ser un número entero entre 0 y 100)"}
        </p>

        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
          Un cambio de pesos afecta a las recomendaciones de los diagnósticos nuevos al instante. Los diagnósticos
          ya guardados no cambian. No se guarda historial: el peso anterior se pierde.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              const inicial: Record<string, string> = {};
              for (const c of criteriosCat) inicial[c.id] = String(Number(c.peso_base));
              setValores(inicial);
              setError(null);
            }}
            disabled={guardando}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Descartar cambios
          </button>
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
          >
            {guardando ? "Guardando..." : "Guardar pesos"}
          </button>
        </div>
      </div>
    </section>
  );
}