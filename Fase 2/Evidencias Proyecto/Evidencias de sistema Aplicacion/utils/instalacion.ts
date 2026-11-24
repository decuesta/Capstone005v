// ============================================================
// utils/instalacion.ts
// Captura el aviso de instalación de la PWA (RF-23). El navegador lo envía
// UNA sola vez, apenas carga la página y mucho antes de que la persona
// llegue al resultado, así que se escucha desde el inicio de la app (lo
// activa RegistrarServiceWorker, que está en el layout) y se guarda aquí
// para que BotonInstalar lo use cuando se muestre.
// ============================================================

export interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let eventoGuardado: EventoInstalacion | null = null;
let escuchando = false;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((oyente) => oyente());
}

// Se puede llamar muchas veces: solo registra los oyentes la primera vez.
export function iniciarCapturaInstalacion() {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // sin aviso automático: la persona decide con el botón
    eventoGuardado = e as EventoInstalacion;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    eventoGuardado = null;
    avisar();
  });
}

export function obtenerEventoInstalacion(): EventoInstalacion | null {
  return eventoGuardado;
}

// El evento solo se puede usar una vez.
export function descartarEventoInstalacion() {
  eventoGuardado = null;
  avisar();
}

export function suscribirseInstalacion(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}
