// ============================================================
// utils/session.ts
// Genera y persiste un identificador de sesión anónima en el
// navegador (localStorage), para poder asociar un diagnóstico hecho
// sin cuenta a la cuenta que el usuario cree después (RF-21, login
// al final del flujo). Es el mecanismo que completa el diseño de
// diagnosticos.sesion_anonima_id, definido hace varias sesiones.
// ============================================================
const CLAVE_SESION = "ematch_sesion_anonima_id";

export function obtenerSesionAnonima(): string {
  if (typeof window === "undefined") return "";

  let sesionId = localStorage.getItem(CLAVE_SESION);
  if (!sesionId) {
    sesionId = crypto.randomUUID();
    localStorage.setItem(CLAVE_SESION, sesionId);
  }
  return sesionId;
}