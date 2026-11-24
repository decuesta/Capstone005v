// ============================================================
// app/admin/agencias/EditorAgencia.tsx
// Alta y edición de una agencia (RF-19), en una ventana superpuesta.
// Una agencia nueva nace INACTIVA y se activa después con "Editar". El
// correo de contacto y la nota del acuerdo son privados: se guardan en una
// tabla que solo tocan las funciones de administrador. Una agencia real
// visible para las personas exige correo de contacto (la base lo vuelve a
// comprobar). No hay eliminar: se desactiva.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { CATEGORIAS_AGENCIA, correoValido, enlaceValido, type AgenciaAdmin } from "./utilidades";

interface EditorAgenciaProps {
  agencia: AgenciaAdmin | null; // null = agencia nueva
  nombresExistentes: string[]; // nombres de las demás agencias
  onCancelar: () => void;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

const si = (v: boolean) => (v ? "Sí" : "No");

export default function EditorAgencia({ agencia, nombresExistentes, onCancelar, onTerminar }: EditorAgenciaProps) {
  const esNueva = agencia === null;
  const [nombre, setNombre] = useState(agencia?.nombre ?? "");
  const [categoria, setCategoria] = useState(agencia?.categoria_servicio ?? "desarrollo_ecommerce");
  const [portafolio, setPortafolio] = useState(agencia?.portafolio_url ?? "");
  const [correo, setCorreo] = useState(agencia?.correo_contacto ?? "");
  const [nota, setNota] = useState(agencia?.nota_acuerdo ?? "");
  const [estado, setEstado] = useState(agencia?.estado ?? "inactivo");
  const [esDemo, setEsDemo] = useState(agencia?.es_demo ?? false);
  const [esAfiliado, setEsAfiliado] = useState(agencia?.es_afiliado ?? false);
  const [consentimiento, setConsentimiento] = useState(agencia?.consentimiento_registrado ?? false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Una agencia es visible si está activa y tiene consentimiento o es de demostración.
  const visible = estado === "activo" && (consentimiento || esDemo);

  async function guardar() {
    setError(null);
    const nombreL = nombre.trim();
    const portafolioL = portafolio.trim();
    const correoL = correo.trim();
    const notaL = nota.trim();

    // 1) Validaciones (la base las vuelve a comprobar).
    if (nombreL.length < 1 || nombreL.length > 100) {
      setError("El nombre de la agencia es obligatorio (máximo 100 caracteres).");
      return;
    }
    if (nombresExistentes.some((n) => n.trim().toLowerCase() === nombreL.toLowerCase())) {
      setError("Ya existe una agencia con ese nombre.");
      return;
    }
    if (portafolioL !== "" && !enlaceValido(portafolioL)) {
      setError("El portafolio debe comenzar con https:// y ser una dirección válida.");
      return;
    }
    if (correoL !== "" && !correoValido(correoL)) {
      setError("El correo de contacto no es válido.");
      return;
    }
    if (notaL.length > 500) {
      setError("La nota del acuerdo admite hasta 500 caracteres.");
      return;
    }
    if (!esNueva && visible && !esDemo && correoL === "") {
      setError("Una agencia real visible para las personas necesita un correo de contacto para poder reenviarle los contactos.");
      return;
    }

    // 2) ¿Qué cambió?
    let otrosCambios = false;
    if (agencia) {
      otrosCambios =
        nombreL !== agencia.nombre ||
        categoria !== agencia.categoria_servicio ||
        portafolioL !== (agencia.portafolio_url ?? "") ||
        correoL !== (agencia.correo_contacto ?? "") ||
        notaL !== (agencia.nota_acuerdo ?? "");
      const sinCambios =
        !otrosCambios &&
        estado === agencia.estado &&
        esDemo === agencia.es_demo &&
        esAfiliado === agencia.es_afiliado &&
        consentimiento === agencia.consentimiento_registrado;
      if (sinCambios) {
        setError("No hay cambios para guardar.");
        return;
      }
    }

    // 3) Confirmación.
    const lineas: string[] = [];
    if (esNueva) {
      lineas.push(`Se creará la agencia ${nombreL} (${CATEGORIAS_AGENCIA[categoria] ?? categoria}).`);
      lineas.push('Nace INACTIVA: no se mostrará a las personas hasta que la actives con "Editar".');
    } else if (agencia) {
      if (estado !== agencia.estado) lineas.push(`Estado: ${agencia.estado === "activo" ? "Activa" : "Inactiva"} → ${estado === "activo" ? "Activa" : "Inactiva"}`);
      if (esDemo !== agencia.es_demo) lineas.push(`Es de demostración: ${si(agencia.es_demo)} → ${si(esDemo)}`);
      if (esAfiliado !== agencia.es_afiliado) lineas.push(`Es afiliada (aviso de acuerdo comercial): ${si(agencia.es_afiliado)} → ${si(esAfiliado)}`);
      if (consentimiento !== agencia.consentimiento_registrado) lineas.push(`Consentimiento registrado: ${si(agencia.consentimiento_registrado)} → ${si(consentimiento)}`);
      if (visible !== agencia.visible_publico) lineas.push(`Visible para las personas: ${si(agencia.visible_publico)} → ${si(visible)}`);
      if (otrosCambios) lineas.push("Se actualizan otros datos (nombre, categoría, portafolio, correo o nota).");
      lineas.unshift(`Cambios en ${agencia.nombre}:`);
    }
    if (consentimiento && !esDemo && notaL === "") {
      lineas.push("\nNo registraste una nota del acuerdo: conviene anotar dónde y cuándo aceptó la agencia aparecer.");
    }
    if (!window.confirm(`${lineas.join("\n")}\n\n¿Confirmas?`)) return;

    // 4) Guardado, con las funciones de la base (solo las ejecuta un administrador).
    setGuardando(true);
    try {
      let mensajeError: string | null = null;
      if (esNueva) {
        const { error: e } = await supabase.rpc("crear_agencia", {
          p_nombre: nombreL,
          p_categoria: categoria,
          p_portafolio_url: portafolioL === "" ? null : portafolioL,
          p_correo_contacto: correoL === "" ? null : correoL,
          p_nota_acuerdo: notaL === "" ? null : notaL,
          p_es_demo: esDemo,
          p_es_afiliado: esAfiliado,
          p_consentimiento: consentimiento,
        });
        mensajeError = e?.message ?? null;
      } else if (agencia) {
        const { error: e } = await supabase.rpc("actualizar_agencia", {
          p_agencia_id: agencia.agencia_id,
          p_nombre: nombreL,
          p_categoria: categoria,
          p_portafolio_url: portafolioL === "" ? null : portafolioL,
          p_estado: estado,
          p_es_demo: esDemo,
          p_es_afiliado: esAfiliado,
          p_consentimiento: consentimiento,
          p_correo_contacto: correoL === "" ? null : correoL,
          p_nota_acuerdo: notaL === "" ? null : notaL,
        });
        mensajeError = e?.message ?? null;
      }
      if (mensajeError) {
        console.error("Error al guardar la agencia:", mensajeError);
        setError(`No se pudo guardar: ${mensajeError}`);
        return;
      }
      onTerminar(
        esNueva
          ? `Agencia ${nombreL} creada como Inactiva. Revisa sus datos y actívala con "Editar" cuando estés listo.`
          : `Agencia ${nombreL} actualizada.`,
        "ok"
      );
    } finally {
      setGuardando(false);
    }
  }

  const campo = "w-full p-3 border border-slate-200 rounded-xl";
  const etiqueta = "block text-sm font-semibold text-slate-700 mb-1";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{esNueva ? "Agregar agencia" : `Editar ${agencia?.nombre}`}</h2>
          <p className="text-sm text-slate-500">
            {esNueva ? 'Se crea inactiva. Después la revisas y la activas con "Editar".' : "No hay eliminar: para dejar de mostrarla, desactívala."}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="ag-nombre" className={etiqueta}>Nombre de la agencia</label>
            <input id="ag-nombre" type="text" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
          </div>

          <div>
            <label htmlFor="ag-categoria" className={etiqueta}>Categoría de servicio</label>
            <select id="ag-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
              {Object.entries(CATEGORIAS_AGENCIA).map(([valor, texto]) => (
                <option key={valor} value={valor}>{texto}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ag-portafolio" className={etiqueta}>Portafolio (opcional)</label>
            <input id="ag-portafolio" type="text" value={portafolio} onChange={(e) => setPortafolio(e.target.value)} placeholder="https://..." className={campo} />
            <p className="text-xs text-slate-500 mt-1">Debe comenzar con https://. Lo ven las personas.</p>
          </div>

          <div>
            <label htmlFor="ag-correo" className={etiqueta}>Correo de contacto (privado)</label>
            <input id="ag-correo" type="text" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="contacto@agencia.cl" className={campo} />
            <p className="text-xs text-slate-500 mt-1">Es el correo al que reenvías los contactos. No lo ven las personas.</p>
          </div>

          <div>
            <label htmlFor="ag-nota" className={etiqueta}>Nota del acuerdo (privada, opcional)</label>
            <textarea id="ag-nota" rows={3} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: aceptó por WhatsApp el 10-10-2026" className={campo} />
            <p className="text-xs text-slate-500 mt-1">Dónde y cuándo aceptó aparecer: es la evidencia del consentimiento.</p>
          </div>

          {!esNueva && (
            <div>
              <label htmlFor="ag-estado" className={etiqueta}>Estado</label>
              <select id="ag-estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={campo}>
                <option value="activo">Activa</option>
                <option value="inactivo">Inactiva</option>
              </select>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} className="mt-1" />
            <span className="text-sm text-slate-700">
              Consentimiento registrado: <strong>la agencia aceptó aparecer en E-Match</strong>. Es lo que permite mostrarla a las personas.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={esAfiliado} onChange={(e) => setEsAfiliado(e.target.checked)} className="mt-1" />
            <span className="text-sm text-slate-700">
              Es afiliada: tiene un acuerdo comercial con E-Match. Las personas verán el aviso de acuerdo comercial.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={esDemo} onChange={(e) => setEsDemo(e.target.checked)} className="mt-1" />
            <span className="text-sm text-slate-700">
              Es de demostración (ficticia): se muestra con una insignia y sus contactos no se reenvían.
            </span>
          </label>
        </div>

        {!esNueva && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
            Visible para las personas con estos datos: <strong>{si(visible)}</strong> (activa y con consentimiento o de demostración).
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onCancelar} disabled={guardando} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl">
            {guardando ? "Guardando..." : esNueva ? "Crear agencia" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}