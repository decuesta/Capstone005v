// ============================================================
// app/components/NuevaClave.tsx
// Pantalla para elegir una contraseña nueva, después de abrir el enlace
// del correo de recuperación (RF-21). El enlace inicia una sesión temporal;
// aquí se fija la contraseña con supabase.auth.updateUser. La contraseña
// nunca se guarda ni se muestra en registros.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";

interface NuevaClaveProps {
  email: string;
  onTerminar: () => void;
  onCancelar: () => void;
}

const LARGO_MINIMO = 8;

export default function NuevaClave({ email, onTerminar, onCancelar }: NuevaClaveProps) {
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  async function guardar() {
    setError(null);
    if (clave.length < LARGO_MINIMO) {
      setError(`La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`);
      return;
    }
    if (clave !== repetida) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      const { error: errorUpdate } = await supabase.auth.updateUser({ password: clave });
      if (errorUpdate) {
        console.warn("No se pudo cambiar la contraseña:", errorUpdate.message);
        if (/different from the old password|same password/i.test(errorUpdate.message)) {
          setError("La nueva contraseña debe ser distinta de la anterior.");
        } else {
          setError(
            "No se pudo cambiar la contraseña. Si el enlace expiró, pide uno nuevo desde la opción de recuperar la clave."
          );
        }
        return;
      }
      setListo(true);
    } finally {
      setGuardando(false);
    }
  }

  if (listo) {
    return (
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Contraseña actualizada</h2>
        <p className="text-sm text-slate-500">Ya puedes usar tu contraseña nueva para iniciar sesión.</p>
        <button
          onClick={onTerminar}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all"
        >
          Continuar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Elige tu nueva contraseña</h2>
        <p className="text-sm text-slate-500 mt-1">Cuenta: {email}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="nueva-clave" className="block text-sm font-semibold text-slate-700 mb-1">
            Nueva contraseña
          </label>
          <input
            id="nueva-clave"
            type="password"
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl"
          />
          <p className="text-xs text-slate-500 mt-1">Al menos {LARGO_MINIMO} caracteres.</p>
        </div>
        <div>
          <label htmlFor="repetir-clave" className="block text-sm font-semibold text-slate-700 mb-1">
            Repite la contraseña
          </label>
          <input
            id="repetir-clave"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between items-center pt-1">
        <button
          onClick={onCancelar}
          disabled={guardando}
          className="text-sm font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
        >
          {guardando ? "Guardando..." : "Guardar contraseña"}
        </button>
      </div>
    </div>
  );
}