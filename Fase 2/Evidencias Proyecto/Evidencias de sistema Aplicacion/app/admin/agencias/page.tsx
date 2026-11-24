// ============================================================
// app/admin/agencias/page.tsx
// Panel de administración (RF-13 y RF-19, modelo concierge). Dos pestañas:
// - Contactos: solicitudes de personas que quieren que una agencia las
//   contacte. El administrador las ve con el correo, el resumen del
//   diagnóstico (solo lo que la persona aceptó compartir) y el correo de
//   destino de la agencia; las copia, las hace llegar a mano y las marca
//   como reenviadas.
// - Agencias: lista, alta y edición. Una agencia nueva nace inactiva. El
//   correo de contacto y la nota del acuerdo son privados. No hay eliminar:
//   se desactiva.
// Las funciones de la base (listar_contactos_agencias,
// marcar_contacto_reenviado, listar_agencias_admin, crear_agencia y
// actualizar_agencia) solo las ejecuta un administrador: esta pantalla no
// es la protección, solo las usa. Solo escritorio (RF-23).
// ============================================================
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import type { AgenciaAdmin, Contacto, Mensaje } from "./utilidades";
import TarjetaContacto from "./TarjetaContacto";
import SeccionAgencias from "./SeccionAgencias";
import EditorAgencia from "./EditorAgencia";

type EstadoAcceso = "verificando" | "sin_sesion" | "sin_permiso" | "admin" | "error";
type Pestana = "contactos" | "agencias";

function Aviso({ titulo, texto, conEnlaceInicio }: { titulo: string; texto: string; conEnlaceInicio?: boolean }) {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-md mx-auto mt-24 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <p className="text-sm text-slate-500">{texto}</p>
        {conEnlaceInicio && (
          <Link href="/" className="inline-block px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all">
            Ir al inicio
          </Link>
        )}
      </div>
    </main>
  );
}

export default function AgenciasPage() {
  const [acceso, setAcceso] = useState<EstadoAcceso>("verificando");
  const [email, setEmail] = useState("");
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [agencias, setAgencias] = useState<AgenciaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("contactos");
  const [verReenviados, setVerReenviados] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<AgenciaAdmin | null>(null);
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

  // 2) Carga contactos y agencias (también recarga tras guardar).
  const cargarDatos = useCallback(async () => {
    const [rContactos, rAgencias] = await Promise.all([
      supabase.rpc("listar_contactos_agencias"),
      supabase.rpc("listar_agencias_admin"),
    ]);
    const fallo = rContactos.error ?? rAgencias.error;
    if (fallo) {
      console.error("No se pudieron cargar los datos:", fallo.message);
      setErrorCarga("No pudimos cargar los datos. Intenta de nuevo más tarde.");
    } else {
      setContactos((rContactos.data ?? []) as Contacto[]);
      setAgencias((rAgencias.data ?? []) as AgenciaAdmin[]);
      setErrorCarga(null);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (acceso === "admin") cargarDatos();
  }, [acceso, cargarDatos]);

  async function terminarOperacion(texto: string, tipo: "ok" | "error") {
    setCreando(false);
    setEditando(null);
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

  // Las agencias de demostración no cuentan como pendientes: no se reenvían.
  const pendientes = contactos.filter((c) => !c.reenviado && !c.agencia_es_demo).length;
  const visibles = contactos.filter((c) => verReenviados || !c.reenviado);
  const clasePestana = (activa: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold ${activa ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"}`;

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Agencias</h1>
            <p className="text-sm text-slate-500">Sesión iniciada como {email}</p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            ← Panel de administración
          </Link>
        </header>

        <div className="flex gap-2">
          <button onClick={() => setPestana("contactos")} className={clasePestana(pestana === "contactos")}>
            Contactos{pendientes > 0 ? ` (${pendientes})` : ""}
          </button>
          <button onClick={() => setPestana("agencias")} className={clasePestana(pestana === "agencias")}>
            Agencias ({agencias.length})
          </button>
        </div>

        {mensaje && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              mensaje.tipo === "ok" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {cargando && <p className="text-sm text-slate-500">Cargando...</p>}
        {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

        {!cargando && !errorCarga && pestana === "contactos" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {pendientes} {pendientes === 1 ? "contacto pendiente" : "contactos pendientes"}
                </h2>
                <p className="text-sm text-slate-500">
                  Solicitudes de personas que quieren que una agencia las contacte. Cópialas, hazlas llegar a la agencia
                  y márcalas como reenviadas.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={verReenviados} onChange={(e) => setVerReenviados(e.target.checked)} />
                Ver también los reenviados
              </label>
            </div>

            {visibles.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                {contactos.length === 0 ? "Todavía no hay contactos." : "No hay contactos pendientes."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibles.map((c) => (
                  <TarjetaContacto key={c.contacto_id} contacto={c} onTerminar={terminarOperacion} />
                ))}
              </ul>
            )}
          </section>
        )}

        {!cargando && !errorCarga && pestana === "agencias" && (
          <SeccionAgencias
            agencias={agencias}
            onNueva={() => {
              setMensaje(null);
              setCreando(true);
            }}
            onEditar={(a) => {
              setMensaje(null);
              setEditando(a);
            }}
          />
        )}

        <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-4">
          <strong>Nota:</strong> en esta etapa del MVP los contactos se hacen llegar a las agencias a mano. Aquí solo se
          ven los datos que la persona aceptó compartir (su correo y los datos de su diagnóstico). Las agencias de
          demostración no reciben contactos. Por su valor crítico, la opción de eliminar agencias solo se ejecuta desde
          el interior de la base de datos y no se habilita en este mantenedor: para dejar de mostrar una, se desactiva.
        </p>
      </div>

      {(creando || editando) && (
        <EditorAgencia
          key={editando?.agencia_id ?? "nueva"}
          agencia={editando}
          nombresExistentes={agencias.filter((a) => a.agencia_id !== editando?.agencia_id).map((a) => a.nombre)}
          onCancelar={() => {
            setCreando(false);
            setEditando(null);
          }}
          onTerminar={terminarOperacion}
        />
      )}
    </main>
  );
}