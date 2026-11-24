// ============================================================
// app/admin/agencias/TarjetaContacto.tsx
// Una fila de la lista de contactos con agencias: resumen, detalle
// expandible, "Copiar datos" y "Marcar reenviado" / "Deshacer".
// El marcado lo hace la función marcar_contacto_reenviado de la base, que
// solo ejecuta un administrador y rechaza las agencias de demostración.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import {
  cantidadLegible,
  etapaLegible,
  fechaHoraCL,
  presupuestoLegible,
  resumenCorto,
  textoParaAgencia,
  urgenciaLegible,
  volumenLegible,
  type Contacto,
} from "./utilidades";

interface TarjetaContactoProps {
  contacto: Contacto;
  onTerminar: (texto: string, tipo: "ok" | "error") => void;
}

export default function TarjetaContacto({ contacto: c, onTerminar }: TarjetaContactoProps) {
  const [expandido, setExpandido] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [textoManual, setTextoManual] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Copia el mensaje al portapapeles. Si el navegador lo bloquea, muestra el
  // texto en un recuadro para copiarlo a mano.
  async function copiar() {
    const texto = textoParaAgencia(c);
    try {
      await navigator.clipboard.writeText(texto);
      setTextoManual(null);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setTextoManual(texto);
    }
  }

  async function marcar(reenviado: boolean) {
    if (!reenviado) {
      if (!window.confirm(`Se desmarcará el contacto con ${c.agencia_nombre} y volverá a figurar como pendiente. ¿Confirmas?`)) {
        return;
      }
    } else {
      const aviso = c.correo ? "" : "\n\nOjo: esta persona no tiene correo registrado.";
      const confirmado = window.confirm(
        `Marcarás como reenviado el contacto de ${c.correo ?? "(sin correo)"} con ${c.agencia_nombre}. ` +
          `Hazlo solo cuando ya le hayas hecho llegar los datos a la agencia.${aviso}\n\n¿Confirmas?`
      );
      if (!confirmado) return;
    }

    setGuardando(true);
    try {
      const { error } = await supabase.rpc("marcar_contacto_reenviado", {
        p_contacto_id: c.contacto_id,
        p_reenviado: reenviado,
      });
      if (error) {
        console.error("Error al marcar el contacto:", error.message);
        onTerminar(`No se pudo actualizar el contacto: ${error.message}`, "error");
        return;
      }
      onTerminar(
        reenviado
          ? `Contacto con ${c.agencia_nombre} marcado como reenviado.`
          : `Contacto con ${c.agencia_nombre} vuelve a figurar como pendiente.`,
        "ok"
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <li className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-900">
            {c.agencia_nombre}
            {c.agencia_es_demo && <span className="ml-2 text-xs font-semibold text-amber-700">Demostración</span>}
          </p>
          <p className="text-sm text-slate-700">{c.correo ?? <span className="text-red-600">Sin correo registrado</span>}</p>
          <p className="text-xs text-slate-500">
            Reenviar a:{" "}
            {c.agencia_es_demo ? (
              "— (demostración)"
            ) : (
              c.agencia_correo_contacto ?? (
                <span className="text-red-600">la agencia no tiene correo de contacto cargado</span>
              )
            )}
          </p>
          <p className="text-xs text-slate-500">
            {fechaHoraCL(c.fecha_contacto)} · {resumenCorto(c)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {c.agencia_es_demo ? (
            <span className="text-xs font-semibold text-amber-700">Demostración: no se reenvía</span>
          ) : c.reenviado ? (
            <>
              <span className="text-xs font-semibold text-green-700">
                Reenviado{c.fecha_reenvio ? ` el ${fechaHoraCL(c.fecha_reenvio)}` : ""}
              </span>
              <button
                onClick={() => marcar(false)}
                disabled={guardando}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                Deshacer
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold text-amber-700">Pendiente</span>
              <button
                onClick={() => marcar(true)}
                disabled={guardando}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
              >
                Marcar reenviado
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setExpandido((v) => !v)}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          {expandido ? "Ocultar resumen" : "Ver resumen"}
        </button>
        <button onClick={copiar} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
          {copiado ? "¡Copiado!" : "Copiar datos"}
        </button>
      </div>

      {expandido && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm bg-slate-50 border border-slate-200 rounded-xl p-3">
          <dt className="text-slate-500">Etapa</dt>
          <dd>{etapaLegible(c.etapa)}</dd>
          <dt className="text-slate-500">Producto o servicio</dt>
          <dd>{c.tipo_producto ?? "—"}</dd>
          <dt className="text-slate-500">Cantidad de productos</dt>
          <dd>{cantidadLegible(c.cantidad_productos)}</dd>
          <dt className="text-slate-500">Presupuesto mensual</dt>
          <dd>{presupuestoLegible(c.presupuesto_mensual)}</dd>
          <dt className="text-slate-500">Ventas mensuales</dt>
          <dd>{volumenLegible(c.volumen_mensual)}</dd>
          <dt className="text-slate-500">Cobertura de despacho</dt>
          <dd>{c.zona_despacho ?? "—"}</dd>
          <dt className="text-slate-500">Urgencia de envío</dt>
          <dd>{urgenciaLegible(c.urgencia_envio)}</dd>
          <dt className="text-slate-500">Plataforma sugerida</dt>
          <dd>{c.plataforma_sugerida ?? "Ninguna (aún no formal)"}</dd>
          <dt className="text-slate-500">Transportista sugerido</dt>
          <dd>{c.courier_sugerido ?? "—"}</dd>
        </dl>
      )}

      {textoManual && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">
            El navegador no permitió copiar automáticamente. Selecciona el texto y cópialo:
          </p>
          <textarea
            readOnly
            value={textoManual}
            rows={14}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full p-3 text-xs border border-slate-200 rounded-xl font-mono"
          />
        </div>
      )}
    </li>
  );
}