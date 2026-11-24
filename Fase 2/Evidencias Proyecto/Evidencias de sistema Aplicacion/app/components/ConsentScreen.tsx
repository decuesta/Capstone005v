// ============================================================
// app/components/ConsentScreen.tsx
// RF-22: pantalla de consentimiento, obligatoria antes de iniciar
// el wizard. No se puede avanzar sin marcar la casilla y presionar
// el botón — RNF-05 (Ley 19.628).
// IMPORTANTE: el texto describe qué datos se envían a los proveedores de
// IA. Hoy el mensaje de generateCanvas.ts incluye solo el tipo de producto,
// la etapa, la zona de despacho y la plataforma y el transportista
// sugeridos (no el correo, el nombre, el presupuesto, el volumen, la
// cantidad de productos ni la urgencia). Si ese mensaje cambia, hay que
// actualizar este texto.
// ============================================================
"use client";

import { useState } from "react";

interface ConsentScreenProps {
  onAceptar: () => void;
  onCancel: () => void;
}

export default function ConsentScreen({ onAceptar, onCancel }: ConsentScreenProps) {
  const [marcado, setMarcado] = useState(false);

  return (
    <div className="max-w-xl w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Antes de empezar</h2>

      <div className="text-sm text-slate-600 space-y-3">
        <p>
          Para generar tu diagnóstico, vamos a pedirte algunos datos sobre tu negocio
          (tipo de producto, etapa, presupuesto, volumen de ventas y zona de despacho).
        </p>
        <p>Estos datos se usan únicamente para:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Calcular la sugerencia de plataforma y transportista.</li>
          <li>Redactar tu informe de Business Model Canvas.</li>
          <li>
            Guardar tu diagnóstico en nuestro sistema, para que puedas consultarlo si creas una
            cuenta y para elaborar estadísticas generales de uso.
          </li>
        </ul>
        <p>
          Para redactar el informe, parte de tus respuestas (tipo de producto, etapa, zona de
          despacho, y la plataforma y el transportista sugeridos) se procesan con proveedores de
          inteligencia artificial externos. No les enviamos tu correo ni tu nombre, y cada
          proveedor aplica sus propias condiciones de uso.
        </p>
        <p>
          Fuera de lo anterior, no compartimos tus datos con terceros, salvo que tú elijas crear
          una cuenta en la plataforma sugerida o contactar a una agencia a través del sistema.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => setMarcado(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm text-slate-700">
          Acepto que mis datos sean usados para generar mi diagnóstico, incluido su procesamiento
          con proveedores de inteligencia artificial externos, conforme a lo descrito arriba.
        </span>
      </label>

      <div className="flex justify-between items-center pt-2">
        <button onClick={onCancel} className="text-sm font-semibold text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
        <button
          onClick={onAceptar}
          disabled={!marcado}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
        >
          Aceptar y continuar
        </button>
      </div>
    </div>
  );
}