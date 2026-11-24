// ============================================================
// app/components/BotonInstalar.tsx
// Invitación a instalar E-Match como app (RF-23). Se muestra solo en la
// pantalla de resultados, así que el panel de administración no lo ve.
// - Android y computador (Chrome/Edge): botón que abre el cuadro de
//   instalación del navegador. El aviso del navegador se captura al abrir la
//   app (utils/instalacion.ts) y aquí solo se usa.
// - iPhone/iPad (Safari): no existe ese botón; se muestra el paso manual.
// - Si la app ya está instalada y abierta como app, no se muestra nada.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import {
  descartarEventoInstalacion,
  obtenerEventoInstalacion,
  suscribirseInstalacion,
  type EventoInstalacion,
} from "@/utils/instalacion";

export default function BotonInstalar() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [esIphone, setEsIphone] = useState(false);
  const [yaInstalada, setYaInstalada] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setYaInstalada(standalone);
    setEsIphone(/iphone|ipad|ipod/i.test(navigator.userAgent));

    // El aviso pudo llegar antes de que apareciera este componente.
    setEvento(obtenerEventoInstalacion());
    return suscribirseInstalacion(() => setEvento(obtenerEventoInstalacion()));
  }, []);

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    descartarEventoInstalacion();
  }

  if (yaInstalada || (!evento && !esIphone)) return null;

  return (
    <div className="rounded-lg border border-blue-300 bg-blue-50 p-4">
      <h3 className="font-semibold">Instala E-Match</h3>
      <p className="text-sm text-gray-600 mt-1">Ábrela como una app desde tu pantalla de inicio.</p>
      {evento ? (
        <button
          onClick={instalar}
          className="mt-3 w-full p-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
        >
          Instalar E-Match
        </button>
      ) : (
        <p className="text-xs text-gray-600 mt-2">
          En iPhone: toca Compartir y luego &quot;Añadir a pantalla de inicio&quot;.
        </p>
      )}
    </div>
  );
}
