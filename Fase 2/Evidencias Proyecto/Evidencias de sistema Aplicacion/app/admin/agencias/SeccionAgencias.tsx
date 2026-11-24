// ============================================================
// app/admin/agencias/SeccionAgencias.tsx
// Lista de todas las agencias (RF-19), incluidas las inactivas y las sin
// consentimiento, con sus marcas, si hoy son visibles para las personas y
// su correo de contacto privado. Alta y edición en EditorAgencia.
// ============================================================
"use client";

import { CATEGORIAS_AGENCIA, type AgenciaAdmin } from "./utilidades";

interface SeccionAgenciasProps {
  agencias: AgenciaAdmin[];
  onNueva: () => void;
  onEditar: (agencia: AgenciaAdmin) => void;
}

export default function SeccionAgencias({ agencias, onNueva, onEditar }: SeccionAgenciasProps) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Agencias</h2>
          <p className="text-sm text-slate-500">
            Todas las agencias. Las personas solo ven las activas con consentimiento registrado o de demostración.
          </p>
        </div>
        <button onClick={onNueva} className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl">
          + Agregar agencia
        </button>
      </div>

      {agencias.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No hay agencias cargadas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Agencia</th>
                <th className="px-6 py-3">Categoría</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Marcas</th>
                <th className="px-6 py-3">Visible</th>
                <th className="px-6 py-3">Correo de contacto</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {agencias.map((a) => (
                <tr key={a.agencia_id} className="border-t border-slate-100 align-top">
                  <td className="px-6 py-4 font-semibold text-slate-900">{a.nombre}</td>
                  <td className="px-6 py-4">{CATEGORIAS_AGENCIA[a.categoria_servicio] ?? a.categoria_servicio}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${a.estado === "activo" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {a.estado === "activo" ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-6 py-4 space-y-1 text-xs">
                    {a.es_demo && <div className="font-semibold text-amber-700">Demostración</div>}
                    {a.es_afiliado && <div className="font-semibold text-slate-700">Afiliada</div>}
                    {a.consentimiento_registrado ? (
                      <div className="text-slate-500">Con consentimiento</div>
                    ) : (
                      !a.es_demo && <div className="font-semibold text-red-600">Sin consentimiento</div>
                    )}
                  </td>
                  <td className="px-6 py-4">{a.visible_publico ? "Sí" : "No"}</td>
                  <td className="px-6 py-4">
                    {a.correo_contacto ?? (
                      a.es_demo ? "—" : <span className="text-red-600">Sin correo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onEditar(a)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}