// ============================================================
// utils/enlaceRecuperacion.ts
// Detecta que la persona llegó desde el enlace del correo de recuperación
// de contraseña (RF-21).
// El cliente de Supabase, apenas se crea, borra de la dirección los datos
// del enlace y emite UNA sola vez el aviso PASSWORD_RECOVERY, durante su
// inicialización. Este módulo se suscribe y lee la dirección en el mismo
// instante en que se crea el cliente (antes de que avance su arranque
// asíncrono) y deja una marca en sessionStorage, que la página lee después.
// No guarda la contraseña ni los datos del enlace: solo un "1".
// ============================================================
import { supabase } from "@/utils/supabase";

const CLAVE = "ematch_recuperando_clave";

function guardarMarca(): void {
  try {
    window.sessionStorage.setItem(CLAVE, "1");
  } catch {
    // Sin almacenamiento disponible: no se puede dejar la marca.
  }
}

if (typeof window !== "undefined") {
  if (window.location.hash.includes("type=recovery")) guardarMarca();
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") guardarMarca();
  });
}

// ¿Llegó la persona por el enlace de recuperación y aún no elige su clave?
export function hayRecuperacionPendiente(): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

// Se llama al terminar o cancelar, al cerrar sesión o si no hay sesión, para
// que la marca no quede pegada.
export function limpiarRecuperacion(): void {
  try {
    window.sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento disponible: nada que limpiar.
  }
}