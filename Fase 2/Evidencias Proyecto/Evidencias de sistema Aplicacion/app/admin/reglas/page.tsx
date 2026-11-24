// ============================================================
// app/admin/reglas/page.tsx
// Panel de administración (RF-17): mantenedor de reglas y pesos del
// motor de scoring. Alcance del MVP: editar los pesos base de los
// criterios (suma exacta de 100 por categoría) y el valor del ajuste de
// las reglas existentes (de -20 a +20). Quedan fuera, como evolución
// posterior: crear o eliminar reglas, editar el umbral mínimo, historial
// de cambios y simulación con perfiles de prueba.
// La protección real está en la base de datos (política de
// administrador, permiso por columna, regla de rango y función de
// pesos). Esta pantalla solo valida lo mismo antes de enviar. Solo
// escritorio (RF-23).
// ============================================================
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import type { Categoria, CriterioFila, Mensaje, Nota, Opcion, Regla } from "./utilidades";
import SeccionPesos from "./SeccionPesos";
import SeccionReglas from "./SeccionReglas";

type EstadoAcceso = "verificando" | "sin_sesion" | "sin_permiso" | "admin" | "error";

function Aviso({ titulo, texto, conEnlaceInicio }: { titulo: string; texto: string; conEnlaceInicio?: boolean }) {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-md mx-auto mt-24 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <p className="text-sm text-slate-500">{texto}</p>
        {conEnlaceInicio && (
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all"
          >
            Ir al inicio
          </Link>
        )}
      </div>
    </main>
  );
}

// Las plataformas se muestran primero.
const ordenCategoria = (nombre: string) => (nombre.toLowerCase().includes("plataforma") ? 0 : 1);

export default function ReglasPage() {
  const [acceso, setAcceso] = useState<EstadoAcceso>("verificando");
  const [email, setEmail] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [criterios, setCriterios] = useState<CriterioFila[]>([]);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  // 1) Verifica la sesión y el rol. No se llama a supabase dentro del
  //    listener de cambios de sesión (puede provocar un bloqueo).
  useEffect(() => {
    let montado = true;

    async function verificarAcceso() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!montado) return;
      if (!session?.user) {
        setAcceso("sin_sesion");
        return;
      }
      setEmail(session.user.email ?? "");

      const { data: esAdmin, error } = await supabase.rpc("es_administrador");
      if (!montado) return;
      if (error) {
        console.error("No se pudo verificar el rol de administrador:", error.message);
        setAcceso("error");
        return;
      }
      setAcceso(esAdmin === true ? "admin" : "sin_permiso");
    }
    verificarAcceso();

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!session) setAcceso("sin_sesion");
    });

    return () => {
      montado = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 2) Carga categorías, criterios, reglas, opciones y notas (también
  //    recarga tras guardar).
  const cargarDatos = useCallback(async () => {
    const [rCat, rCri, rReg, rOpc, rNot] = await Promise.all([
      supabase.from("scoring_category").select("id, nombre"),
      supabase.from("scoring_criteria").select("id, categoria_id, nombre, peso_base"),
      supabase.from("scoring_weight_rule").select("id, criteria_id, condicion, ajuste_peso"),
      supabase.from("scoring_option").select("id, categoria_id, nombre, activo"),
      supabase.from("scoring_option_rating").select("option_id, criteria_id, calificacion"),
    ]);
    const fallo = rCat.error ?? rCri.error ?? rReg.error ?? rOpc.error ?? rNot.error;
    if (fallo) {
      console.error("No se pudieron cargar los datos:", fallo.message);
      setErrorCarga("No pudimos cargar los datos. Intenta de nuevo más tarde.");
    } else {
      setCategorias(
        [...((rCat.data ?? []) as Categoria[])].sort(
          (a, b) => ordenCategoria(a.nombre) - ordenCategoria(b.nombre) || a.nombre.localeCompare(b.nombre, "es")
        )
      );
      setCriterios((rCri.data ?? []) as CriterioFila[]);
      setReglas((rReg.data ?? []) as Regla[]);
      setOpciones((rOpc.data ?? []) as Opcion[]);
      setNotas((rNot.data ?? []) as Nota[]);
      setErrorCarga(null);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (acceso === "admin") cargarDatos();
  }, [acceso, cargarDatos]);

  async function terminarOperacion(texto: string, tipo: "ok" | "error") {
    setMensaje({ texto, tipo });
    await cargarDatos();
  }

  if (acceso === "verificando") {
    return <Aviso titulo="Verificando acceso..." texto="Un momento, por favor." />;
  }
  if (acceso === "sin_sesion") {
    return (
      <Aviso
        titulo="Necesitas iniciar sesión"
        texto="Inicia sesión con tu cuenta de administrador desde la pantalla de inicio y vuelve a esta página."
        conEnlaceInicio
      />
    );
  }
  if (acceso === "sin_permiso") {
    return (
      <Aviso
        titulo="No tienes acceso a esta sección"
        texto={`La cuenta ${email} no tiene permisos de administración.`}
        conEnlaceInicio
      />
    );
  }
  if (acceso === "error") {
    return <Aviso titulo="No pudimos verificar tu acceso" texto="Intenta de nuevo en unos minutos." conEnlaceInicio />;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reglas y pesos del motor</h1>
            <p className="text-sm text-slate-500">Sesión iniciada como {email}</p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            ← Panel de administración
          </Link>
        </header>

        {mensaje && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              mensaje.tipo === "ok"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {cargando && <p className="text-sm text-slate-500">Cargando...</p>}
        {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

        {!cargando && !errorCarga && (
          <>
            <SeccionPesos
              categorias={categorias}
              criterios={criterios}
              opciones={opciones}
              notas={notas}
              onTerminar={terminarOperacion}
            />
            <SeccionReglas
              categorias={categorias}
              criterios={criterios}
              reglas={reglas}
              onTerminar={terminarOperacion}
            />
          </>
        )}

        <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-4">
          <strong>Nota:</strong> en esta etapa del MVP solo se editan los pesos y el valor de los ajustes. Crear o
          eliminar reglas, y cambiar el umbral mínimo, se hace por ahora desde la base de datos. Los cambios no
          guardan historial.
        </p>
      </div>
    </main>
  );
}