// ============================================================
// app/components/RegistrarServiceWorker.tsx
// Al abrir cualquier página: registra el service worker de la PWA (RF-23) y
// empieza a escuchar el aviso de instalación del navegador (ver
// utils/instalacion.ts). No dibuja nada. Si el navegador no lo soporta, no
// pasa nada.
// ============================================================
"use client";

import { useEffect } from "react";
import { iniciarCapturaInstalacion } from "@/utils/instalacion";

export default function RegistrarServiceWorker() {
  useEffect(() => {
    iniciarCapturaInstalacion();
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo registrar el service worker:", error);
    });
  }, []);

  return null;
}
