// ============================================================
// app/admin/transportistas/page.tsx
// Panel de administración (RF-18): mantenedor de transportistas y sus
// tarifas. Alcance del MVP: lista con activar/desactivar (no hay
// eliminar: borrar solo se hace desde la base de datos), edición del
// enlace del transportista y de la casilla "es afiliado", tarifas de cada
// transportista (editar precio y fecha en el lugar, sin historial, y
// "Marcar tarifario verificado") y detalle de solo lectura.
// Quedan fuera, como evolución posterior: crear transportistas, zonas,
// servicios o tramos, retirar tarifas sueltas, historial de precios,
// cobertura por transportista y edición de las notas.
// La protección real está en la base de datos (política de
// administrador, permiso por columnas y regla de fecha). Esta pantalla
// solo valida lo mismo antes de enviar. Solo escritorio (RF-23).
// ============================================================
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import { agrupar, DIAS_REVISAR, diasDesde, fechaCL, pesos, type Courier, type Mensaje, type Tarifa } from "./utilidades";
import EditorTarifa from "./EditorTarifa";
import EditorEnlace from "./EditorEnlace";
import VerificarTarifario from "./VerificarTarifario";
import DetalleCourier from "./DetalleCourier";

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

export default function TransportistasPage() {
  const [acceso, setAcceso] = useState<EstadoAcceso>("verificando");
  const [email, setEmail] = useState("");
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [verTarifasDe, setVerTarifasDe] = useState<string | null>(null);
  const [editando, setEditando] = useState<Tarifa | null>(null);
  const [marcando, setMarcando] = useState<Courier | null>(null);
  const [detalle, setDetalle] = useState<Courier | null>(null);
  const [editandoEnlace, setEditandoEnlace] = useState<Courier | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null);
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

  // 2) Carga los transportistas y sus tarifas (también recarga tras guardar).
  const cargarDatos = useCallback(async () => {
    const { data: categoria, error: errorCategoria } = await supabase
      .from("scoring_category")
      .select("id")
      .eq("nombre", "Couriers y Logística")
      .single();
    if (errorCategoria || !categoria) {
      console.error("No se pudo leer la categoría de transportistas:", errorCategoria?.message);
      setErrorCarga("No pudimos cargar los transportistas. Intenta de nuevo más tarde.");
      setCargando(false);
      return;
    }

    const [respuestaCouriers, respuestaTarifas] = await Promise.all([
      supabase
        .from("scoring_option")
        .select("id, nombre, activo, enlace_afiliado, es_afiliado")
        .eq("categoria_id", categoria.id)
        .order("nombre"),
      supabase
        .from("tarifas_transporte")
        .select("id, courier_option_id, servicio, zona_origen, zona_destino, quiebre_peso, tarifa, fecha_vigencia"),
    ]);

    if (respuestaCouriers.error || respuestaTarifas.error) {
      console.error(
        "No se pudieron cargar los datos:",
        respuestaCouriers.error?.message ?? respuestaTarifas.error?.message
      );
      setErrorCarga("No pudimos cargar los datos. Intenta de nuevo más tarde.");
    } else {
      setCouriers((respuestaCouriers.data ?? []) as Courier[]);
      setTarifas((respuestaTarifas.data ?? []) as Tarifa[]);
      setErrorCarga(null);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (acceso === "admin") cargarDatos();
  }, [acceso, cargarDatos]);

  // Cierra cualquier ventana abierta, muestra el aviso y recarga los datos.
  async function terminarOperacion(texto: string, tipo: "ok" | "error") {
    setEditando(null);
    setMarcando(null);
    setEditandoEnlace(null);
    setMensaje({ texto, tipo });
    await cargarDatos();
  }

  // Activa o desactiva un transportista (no se elimina).
  async function cambiarEstado(courier: Courier) {
    const nuevoEstado = !courier.activo;
    if (!nuevoEstado && !couriers.some((c) => c.id !== courier.id && c.activo)) {
      setMensaje({
        texto: "No se puede desactivar el último transportista activo: el sistema no tendría qué recomendar.",
        tipo: "error",
      });
      return;
    }
    const confirmado = window.confirm(
      nuevoEstado
        ? `Se activará ${courier.nombre}: volverá a incluirse en las recomendaciones de los diagnósticos nuevos. ¿Confirmas?`
        : `Se desactivará ${courier.nombre}: dejará de incluirse en las recomendaciones de los diagnósticos nuevos. Los diagnósticos ya guardados no cambian. ¿Confirmas?`
    );
    if (!confirmado) return;

    setMensaje(null);
    setCambiandoEstado(courier.id);
    const { data, error } = await supabase
      .from("scoring_option")
      .update({ activo: nuevoEstado })
      .eq("id", courier.id)
      .select("id");
    setCambiandoEstado(null);

    if (error || !data || data.length !== 1) {
      console.error("Error al cambiar el estado:", error?.message);
      setMensaje({
        texto: `No se pudo cambiar el estado de ${courier.nombre}: ${
          error?.message ?? "la base no aceptó el cambio (revisa tu sesión y tus permisos)."
        }`,
        tipo: "error",
      });
      return;
    }
    setMensaje({ texto: `${courier.nombre} quedó ${nuevoEstado ? "activo" : "inactivo"}.`, tipo: "ok" });
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

  const courierSeleccionado = couriers.find((c) => c.id === verTarifasDe) ?? null;
  const tarifasSeleccionado = tarifas.filter((t) => t.courier_option_id === verTarifasDe);
  const grupos = agrupar(tarifasSeleccionado);

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Transportistas</h1>
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

        {/* PANTALLA 1: lista de transportistas */}
        {!cargando && !errorCarga && !courierSeleccionado && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Transportistas</h2>
              <p className="text-sm text-slate-500">Estado de cada transportista y vigencia de sus tarifas.</p>
            </div>

            {couriers.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No hay transportistas cargados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Transportista</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3">Tarifas</th>
                    <th className="px-6 py-3">Vigencia más antigua</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.map((c) => {
                    const delCourier = tarifas.filter((t) => t.courier_option_id === c.id);
                    const masAntigua = delCourier.reduce(
                      (min, t) => (min === "" || t.fecha_vigencia < min ? t.fecha_vigencia : min),
                      ""
                    );
                    return (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="px-6 py-4 font-semibold text-slate-900">{c.nombre}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              c.activo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {c.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-6 py-4">{delCourier.length}</td>
                        <td className="px-6 py-4">
                          {masAntigua === "" ? "—" : fechaCL(masAntigua)}
                          {masAntigua !== "" && diasDesde(masAntigua) > DIAS_REVISAR && (
                            <span className="ml-2 text-xs font-semibold text-amber-600">Revisar</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setMensaje(null);
                              setVerTarifasDe(c.id);
                            }}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 mr-4"
                          >
                            Ver tarifas
                          </button>
                          <button
                            onClick={() => {
                              setMensaje(null);
                              setDetalle(c);
                            }}
                            className="text-sm font-semibold text-slate-600 hover:text-slate-900 mr-4"
                          >
                            Ver detalle
                          </button>
                          <button
                            onClick={() => {
                              setMensaje(null);
                              setEditandoEnlace(c);
                            }}
                            className="text-sm font-semibold text-slate-600 hover:text-slate-900 mr-4"
                          >
                            Editar enlace
                          </button>
                          <button
                            onClick={() => cambiarEstado(c)}
                            disabled={cambiandoEstado === c.id}
                            className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
                          >
                            {c.activo ? "Desactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* PANTALLA 2: tarifas de un transportista */}
        {!cargando && !errorCarga && courierSeleccionado && (
          <section className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <button
                  onClick={() => setVerTarifasDe(null)}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  ← Volver a transportistas
                </button>
                <h2 className="text-xl font-bold text-slate-900 mt-2">Tarifas de {courierSeleccionado.nombre}</h2>
                <p className="text-sm text-slate-500">
                  {tarifasSeleccionado.length} tarifas. Se editan en el lugar, sin historial.
                </p>
              </div>
              <button
                onClick={() => {
                  setMensaje(null);
                  setMarcando(courierSeleccionado);
                }}
                className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
              >
                Marcar tarifario verificado
              </button>
            </div>

            {grupos.length === 0 && <p className="text-sm text-slate-500">Este transportista no tiene tarifas cargadas.</p>}

            {grupos.map((g) => (
              <div key={g.clave} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">{g.servicio}</h3>
                  <p className="text-xs text-slate-500">Origen {g.origen}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Destino</th>
                        {g.tramos.map((t) => (
                          <th key={t} className="px-4 py-3">
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.zonas.map((z) => (
                        <tr key={z} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-900">{z}</td>
                          {g.tramos.map((t) => {
                            const celda = g.celdas.get(`${z}|${t}`);
                            return (
                              <td key={t} className="px-4 py-3 align-top">
                                {celda ? (
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-slate-900">{pesos(celda.tarifa)}</div>
                                    <div className="text-xs text-slate-400">{fechaCL(celda.fecha_vigencia)}</div>
                                    {diasDesde(celda.fecha_vigencia) > DIAS_REVISAR && (
                                      <div className="text-xs font-semibold text-amber-600">Revisar</div>
                                    )}
                                    <button
                                      onClick={() => {
                                        setMensaje(null);
                                        setEditando(celda);
                                      }}
                                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                    >
                                      Editar
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        )}

        <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-4">
          <strong>Nota:</strong> por su valor crítico, la opción de eliminar solo se ejecuta desde el interior
          de la base de datos y no se habilita a través de este mantenedor. Para dejar de ofrecer un
          transportista, se desactiva (estado Inactivo). Agregar transportistas, zonas, servicios o tramos
          también se hace por ahora desde la base de datos.
        </p>
      </div>

      {editando && courierSeleccionado && (
        <EditorTarifa
          key={editando.id}
          fila={editando}
          nombreCourier={courierSeleccionado.nombre}
          onCancelar={() => setEditando(null)}
          onTerminar={terminarOperacion}
        />
      )}

      {marcando && (
        <VerificarTarifario
          key={marcando.id}
          courier={marcando}
          tarifasCourier={tarifas.filter((t) => t.courier_option_id === marcando.id)}
          onCancelar={() => setMarcando(null)}
          onTerminar={terminarOperacion}
        />
      )}

      {editandoEnlace && (
        <EditorEnlace
          key={editandoEnlace.id}
          courier={editandoEnlace}
          onCancelar={() => setEditandoEnlace(null)}
          onTerminar={terminarOperacion}
        />
      )}

      {detalle && (
        <DetalleCourier
          key={detalle.id}
          courier={detalle}
          cantidadTarifas={tarifas.filter((t) => t.courier_option_id === detalle.id).length}
          couriers={couriers}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </main>
  );
}