// ============================================================
// app/components/AuthScreen.tsx
// RF-21: registro, inicio de sesión y recuperación de contraseña.
// Usa Supabase Auth directamente (no hay backend propio de
// autenticación) — es el patrón recomendado por Supabase para
// apps cliente: las credenciales nunca pasan por nuestro propio
// código, van directo al servicio de Auth.
// Al registrarse o iniciar sesión con éxito, reclama el diagnóstico
// anónimo (sesion_anonima_id) asociándolo al usuario recién
// identificado.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";

interface AuthScreenProps {
  sesionAnonimaId: string;
  onAutenticado: () => void;
  onOmitir: () => void;
  modoInicial?: Modo;
  mostrarOmitir?: boolean;
}

type Modo = "registro" | "login" | "recuperar";

export default function AuthScreen({ sesionAnonimaId, onAutenticado, onOmitir, modoInicial = "registro", mostrarOmitir = true }: AuthScreenProps) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

   // Asocia el diagnóstico anónimo (por sesion_anonima_id) a la cuenta
  // de la persona que acaba de registrarse o iniciar sesión. Usa la
  // función reclamar_diagnosticos de la base de datos (no un UPDATE
  // directo) para que siga funcionando cuando Row Level Security esté
  // activo en diagnosticos. El usuario se toma de la sesión, no del
  // parámetro.
  async function reclamarDiagnostico(_usuarioId: string) {
    const { error: errorReclamo } = await supabase.rpc("reclamar_diagnosticos", {
      p_sesion_anonima_id: sesionAnonimaId,
    });
    if (errorReclamo) {
      console.error("No se pudo asociar el diagnóstico a la cuenta:", errorReclamo.message);
    }
  }

  // Crea la fila correspondiente en la tabla usuarios (datos propios
  // de la app, separados de las credenciales que Supabase Auth ya
  // administra en auth.users).
  async function crearFilaUsuario(usuarioId: string, correo: string) {
    const { error: errorUsuario } = await supabase
      .from("usuarios")
      .insert({ id: usuarioId, email: correo, rol: "emprendedor" });
    // Si ya existe (ej. el usuario inició sesión de nuevo), no es un error real.
    if (errorUsuario && errorUsuario.code !== "23505") {
      console.error("No se pudo crear la fila de usuario:", errorUsuario.message);
    }
  }

  async function manejarRegistro() {
    setCargando(true);
    setError(null);
    const { data, error: errorAuth } = await supabase.auth.signUp({ email, password });
    if (errorAuth) {
      setError(errorAuth.message);
      setCargando(false);
      return;
    }
    if (data.user) {
      await crearFilaUsuario(data.user.id, email);
      await reclamarDiagnostico(data.user.id);
    }
    setCargando(false);

    if (data.session) {
      onAutenticado(); // Confirmación de email desactivada: entra directo.
    } else {
      setMensaje("Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.");
    }
  }

  async function manejarLogin() {
    setCargando(true);
    setError(null);
    const { data, error: errorAuth } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (errorAuth) {
      setError(errorAuth.message);
      return;
    }
    if (data.user) {
      await reclamarDiagnostico(data.user.id);
    }
    onAutenticado();
  }

  async function manejarRecuperacion() {
    setCargando(true);
    setError(null);
    const { error: errorAuth } = await supabase.auth.resetPasswordForEmail(email);
    setCargando(false);
    if (errorAuth) {
      setError(errorAuth.message);
      return;
    }
    setMensaje("Te enviamos un correo con instrucciones para recuperar tu contraseña.");
  }

  function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (modo === "registro") manejarRegistro();
    else if (modo === "login") manejarLogin();
    else manejarRecuperacion();
  }

  return (
    <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Guarda tu resultado</h2>
        <p className="text-sm text-slate-500 mt-1">
          Crea una cuenta o inicia sesión para no perder tu diagnóstico.
        </p>
      </div>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => { setModo("registro"); setError(null); setMensaje(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium ${modo === "registro" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Crear cuenta
        </button>
        <button
          onClick={() => { setModo("login"); setError(null); setMensaje(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium ${modo === "login" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Iniciar sesión
        </button>
        <button
          onClick={() => { setModo("recuperar"); setError(null); setMensaje(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium ${modo === "recuperar" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Olvidé mi clave
        </button>
      </div>

      <form onSubmit={manejarEnvio} className="space-y-4">
        <input
          type="email"
          placeholder="tu@correo.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-3 border border-slate-200 rounded-xl"
        />
        {modo !== "recuperar" && (
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full p-3 border border-slate-200 rounded-xl"
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {mensaje && <p className="text-sm text-green-700">{mensaje}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl"
        >
          {cargando ? "Procesando..." : modo === "registro" ? "Crear cuenta" : modo === "login" ? "Iniciar sesión" : "Enviar instrucciones"}
        </button>
      </form>

            {mostrarOmitir && (
        <button onClick={onOmitir} className="text-sm text-slate-400 hover:text-slate-600 w-full text-center">
          Omitir por ahora
        </button>
      )}
    </div>
  );
}