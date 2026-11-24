// ============================================================
// app/components/CanvasReport.tsx
// Resultado del diagnóstico: recomendación de plataforma y transportista
// con su fundamento (RF-08), costo estimado, Canvas y descarga del PDF.
// Cada tarjeta tiene su botón para ir al sitio de la plataforma o del
// transportista (ventana nueva); el clic se registra contra el
// diagnóstico con la función registrar_clic_afiliado de la base. El aviso
// de comisión solo aparece en los enlaces marcados como afiliados.
// Los diagnósticos guardados antes de este cambio no traen identificadores
// de opción: en ellos el botón funciona pero el clic no se registra.
// RF-05: la persona puede corregir el texto de cada bloque del Canvas.
// La versión editada se usa en la pantalla y en el PDF, y se conserva
// mientras la pestaña siga abierta (sessionStorage), para no perderla al
// ir al plan paso a paso o al crear la cuenta para descargar. El
// diagnóstico guardado en la base NO cambia: queda como registro de lo
// que E-Match recomendó.
// ============================================================
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import type { ResultadoDiagnostico } from "@/app/actions/generateCanvas";
import type { CanvasIAOutput } from "@/app/types/canvas";
import BotonInstalar from "./BotonInstalar";
import CalificarUtilidad from "./CalificarUtilidad";

interface CanvasReportProps {
  resultado: ResultadoDiagnostico;
  // Se pasa desde "Mis diagnósticos": los guardados antes de este cambio
  // no traen el identificador dentro del resultado.
    diagnosticoId?: string;
  // Si se pasa, aparece el botón "Inicia y escala paso a paso", que lleva
  // a la pantalla del plan.
  onPlanPasoAPaso?: () => void;
    // Si es false y se pasa onCrearCuenta, el botón del PDF pide crear una
  // cuenta antes de descargar (es un incentivo de registro, no una
  // protección: la ruta del PDF no entrega datos de la base).
  puedeDescargar?: boolean;
  onCrearCuenta?: () => void;
}

const AVISO_AFILIADO =
  "Enlace de afiliado: E-Match puede recibir una comisión si contratas, sin costo adicional para ti.";

// Los 9 bloques del Canvas, en el orden en que se muestran.
const BLOQUES_CANVAS: { clave: keyof CanvasIAOutput; etiqueta: string }[] = [
  { clave: "propuestaValor", etiqueta: "Propuesta de valor" },
  { clave: "segmentoClientes", etiqueta: "Segmento de clientes" },
  { clave: "canales", etiqueta: "Canales" },
  { clave: "relacionClientes", etiqueta: "Relación con clientes" },
  { clave: "fuentesIngreso", etiqueta: "Fuentes de ingreso" },
  { clave: "recursosClave", etiqueta: "Recursos clave" },
  { clave: "actividadesClave", etiqueta: "Actividades clave" },
  { clave: "sociosClave", etiqueta: "Socios clave" },
  { clave: "estructuraCostos", etiqueta: "Estructura de costos" },
];

// Mismo largo máximo por bloque que acepta el servidor al validar el Canvas de la IA.
const LARGO_MAXIMO_BLOQUE = 1500;

// El PDF usa la fuente Helvetica estándar, que no acepta saltos de línea
// ni caracteres fuera del alfabeto latino (por ejemplo, emojis): si se
// colaran, el PDF no se generaría. Se reemplazan los saltos de línea por
// espacios y se quitan los caracteres que la fuente no puede escribir.
function limpiarTextoEditado(texto: string): string {
  return texto
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g, "")
    .trim()
    .slice(0, LARGO_MAXIMO_BLOQUE);
}

// Recupera una edición hecha antes en esta misma pestaña (por ejemplo,
// antes de ir al plan paso a paso o de crear la cuenta). Solo acepta los 9
// bloques conocidos y los limpia de nuevo. Si el navegador no permite
// sessionStorage, o no hay nada guardado, devuelve null.
// Este componente solo se muestra después de una acción de la persona
// (nunca en la primera carga desde el servidor), así que puede leer
// sessionStorage al crearse.
function leerEdicionGuardada(clave: string | null, original: CanvasIAOutput): CanvasIAOutput | null {
  if (!clave || typeof window === "undefined") return null;
  try {
    const guardado = sessionStorage.getItem(clave);
    if (!guardado) return null;
    const datos: unknown = JSON.parse(guardado);
    if (typeof datos !== "object" || datos === null) return null;
    const registro = datos as Record<string, unknown>;
    const canvas = {} as CanvasIAOutput;
    for (const { clave: bloque } of BLOQUES_CANVAS) {
      const valor = registro[bloque];
      canvas[bloque] = (typeof valor === "string" && limpiarTextoEditado(valor)) || original[bloque];
    }
    return canvas;
  } catch {
    return null;
  }
}

// Solo se muestran enlaces https (los guarda un administrador, pero se
// valida igual antes de ponerlos en la página).
function enlaceSeguro(enlace: string | null | undefined): string | null {
  return typeof enlace === "string" && enlace.startsWith("https://") ? enlace : null;
}

export default function CanvasReport({
  resultado,
  diagnosticoId,
  onPlanPasoAPaso,
  puedeDescargar = true,
  onCrearCuenta,
}: CanvasReportProps) {
  const { canvas, generadoPorIA, plataforma, courier, costoEstimado, sinRecomendacionPlataforma, motivoSinRecomendacion, esServicio } = resultado;
  const [descargando, setDescargando] = useState(false);
  const idDiagnostico = diagnosticoId ?? resultado.diagnosticoId;

  // RF-05: Canvas con las correcciones de la persona (null = sin editar).
  const claveEdicion = idDiagnostico ? `ematch_canvas_editado_${idDiagnostico}` : null;
  const [canvasEditado, setCanvasEditado] = useState<CanvasIAOutput | null>(() =>
    leerEdicionGuardada(claveEdicion, canvas)
  );
  const [borrador, setBorrador] = useState<CanvasIAOutput | null>(null);
  const canvasMostrado = canvasEditado ?? canvas;

  function empezarEdicion() {
    setBorrador({ ...canvasMostrado });
  }

  function guardarEdicion() {
    if (!borrador) return;
    // Un bloque que quede vacío vuelve a su texto original.
    const limpio = {} as CanvasIAOutput;
    for (const { clave } of BLOQUES_CANVAS) {
      limpio[clave] = limpiarTextoEditado(borrador[clave]) || canvas[clave];
    }
    setCanvasEditado(limpio);
    setBorrador(null);
    if (claveEdicion) {
      try {
        sessionStorage.setItem(claveEdicion, JSON.stringify(limpio));
      } catch {
        // Sin sessionStorage: la edición vive solo mientras la pantalla esté abierta.
      }
    }
  }

  function volverAlOriginal() {
    setCanvasEditado(null);
    setBorrador(null);
    if (claveEdicion) {
      try {
        sessionStorage.removeItem(claveEdicion);
      } catch {
        // Nada que limpiar.
      }
    }
  }
    const bloqueadoPorCuenta = !puedeDescargar && !!onCrearCuenta;
  const enlacePlataforma = enlaceSeguro(plataforma?.enlaceAfiliado);
  const enlaceCourier = enlaceSeguro(courier?.enlaceAfiliado);

  // Registra el clic sin esperar la respuesta: el enlace se abre de todas
  // formas, y un fallo del registro no debe molestar a la persona.
  function registrarClic(optionId: string | undefined) {
    if (!idDiagnostico || !optionId) return;
    supabase
      .rpc("registrar_clic_afiliado", { p_diagnostico_id: idDiagnostico, p_option_id: optionId })
      .then(({ error }) => {
        if (error) console.error("No se pudo registrar el clic:", error.message);
      });
  }

  async function descargarPDF() {
    setDescargando(true);
    try {
      const respuesta = await fetch("/api/exportar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...resultado, canvas: canvasMostrado }),
      });
      if (!respuesta.ok) throw new Error("No se pudo generar el PDF");

      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "diagnostico-e-match.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar el PDF:", error);
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="space-y-6">
      {sinRecomendacionPlataforma ? (
        <div className="rounded-lg border p-4 bg-amber-50">
          <h3 className="font-semibold">Aún no es momento de una plataforma formal</h3>
          <p className="text-sm text-gray-700 mt-1">{motivoSinRecomendacion}</p>
          <p className="text-sm text-gray-700 mt-1">Te sugerimos partir con WhatsApp Business o Instagram Shopping.</p>
        </div>
      ) : (
        plataforma && (
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Plataforma: mejor ajuste para tu perfil</h3>
            <p className="text-lg">{plataforma.nombre}</p>
            <p className="text-sm text-gray-500">Puntaje de ajuste: {plataforma.puntaje}/100</p>
            <p className="text-sm text-gray-700 mt-1">{plataforma.fundamento}</p>
            {esServicio && (
  <p className="text-xs text-gray-500 mt-1">
    Es una tienda online: antes de contratar, revisa en su sitio qué funciones de reservas o agenda ofrece según el plan.
  </p>
)}
            {enlacePlataforma && (
              <div className="mt-3 space-y-1">
                <a
                  href={enlacePlataforma}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => registrarClic(plataforma.id)}
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
                >
                  Ir a {plataforma.nombre} y crear mi cuenta
                </a>
                {plataforma.esAfiliado && <p className="text-xs text-gray-500">{AVISO_AFILIADO}</p>}
              </div>
            )}
          </div>
        )
      )}

      {courier && (
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Transportista: mejor ajuste para tu perfil</h3>
          <p className="text-lg">{courier.nombre}</p>
          <p className="text-sm text-gray-500">Puntaje de ajuste: {courier.puntaje}/100</p>
          <p className="text-sm text-gray-700 mt-1">{courier.fundamento}</p>
          {enlaceCourier && (
            <div className="mt-3 space-y-1">
              <a
                href={enlaceCourier}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => registrarClic(courier.id)}
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
              >
                Conocer cómo contratar con {courier.nombre}
              </a>
              {courier.esAfiliado && <p className="text-xs text-gray-500">{AVISO_AFILIADO}</p>}
            </div>
          )}
        </div>
      )}

      {costoEstimado && (
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Costo mensual estimado</h3>
          <p>Plan {costoEstimado.plan}: ${costoEstimado.precioPlan.toLocaleString("es-CL")}</p>
          <p>Comisión estimada: ${costoEstimado.comisionEstimada.toLocaleString("es-CL")}</p>
          {costoEstimado.costoEnvio !== null && (
  <p>Envío (referencia 3 kg): ${costoEstimado.costoEnvio.toLocaleString("es-CL")}</p>
)}
          <p className="font-semibold">Total estimado: ${costoEstimado.totalEstimado.toLocaleString("es-CL")}</p>
          {costoEstimado.esEstimacionMinima && (
            <p className="text-xs text-gray-500 mt-1">Estimación mínima: tu volumen de ventas puede ser mayor al usado en este cálculo.</p>
          )}
          <p className="text-xs text-gray-500">{costoEstimado.costoEnvio !== null ? "Tarifario" : "Precios"} vigente al {costoEstimado.fechaVigenciaTarifa}. Estimación referencial, no vinculante.</p>
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h3 className="font-semibold mb-2">Tu Business Model Canvas</h3>
        {!generadoPorIA && (
          <p className="text-xs text-amber-600 mb-2">Generado con plantilla de respaldo (la IA no estuvo disponible en este momento).</p>
        )}
        {canvasEditado && !borrador && (
          <p className="text-xs text-blue-700 mb-2">Editado por ti. El PDF usa esta versión; tu diagnóstico guardado conserva la original.</p>
        )}

        {borrador ? (
          <div className="grid gap-3 text-sm">
            {BLOQUES_CANVAS.map(({ clave, etiqueta }) => (
              <label key={clave} className="block">
                <span className="font-semibold">{etiqueta}</span>
                <textarea
                  value={borrador[clave]}
                  maxLength={LARGO_MAXIMO_BLOQUE}
                  rows={3}
                  onChange={(e) => setBorrador({ ...borrador, [clave]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </label>
            ))}
            <p className="text-xs text-gray-500">Si dejas un bloque vacío, vuelve a su texto original. Los emojis no se incluyen en el PDF.</p>
            <div className="flex gap-2">
              <button
                onClick={guardarEdicion}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl"
              >
                Guardar cambios
              </button>
              <button
                onClick={() => setBorrador(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 text-sm">
              {BLOQUES_CANVAS.map(({ clave, etiqueta }) => (
                <p key={clave}><strong>{etiqueta}:</strong> {canvasMostrado[clave]}</p>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                onClick={empezarEdicion}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                ✏️ Editar mi Canvas
              </button>
              {canvasEditado && (
                <button
                  onClick={volverAlOriginal}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Volver al texto original
                </button>
              )}
            </div>
          </>
        )}
      </div>

            {onPlanPasoAPaso && (
        <button
          onClick={onPlanPasoAPaso}
          className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all"
        >
          Inicia y escala paso a paso
        </button>
      )}

      {/* RF-14: "¿Te sirvió este diagnóstico?" (solo si el diagnóstico tiene identificador). */}
      {idDiagnostico && <CalificarUtilidad diagnosticoId={idDiagnostico} />}

            {bloqueadoPorCuenta ? (
        <button
          onClick={onCrearCuenta}
          className="w-full p-4 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all"
        >
          🔒 Crea tu cuenta para descargar tu PDF
        </button>
      ) : (
        <button
          onClick={descargarPDF}
          disabled={descargando}
          className="w-full p-4 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all disabled:opacity-50"
        >
          {descargando ? "Generando PDF..." : "📄 Descargar PDF"}
        </button>

        
      )}
      <BotonInstalar />
    </div>
  );
}