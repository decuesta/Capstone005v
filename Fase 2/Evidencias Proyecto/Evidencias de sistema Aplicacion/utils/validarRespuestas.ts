// ============================================================
// utils/validarRespuestas.ts
// Valida en el servidor que cada respuesta del wizard sea exactamente
// una de las opciones reales que ofrece el wizard. Una Server Action
// es un endpoint público: sin esta validación, cualquiera podría
// mandar texto arbitrario (que además se inserta en el prompt de
// Gemini) o guardar filas con valores inventados.
// MANTENIMIENTO: si se agrega o cambia una opción en Wizard.tsx,
// hay que actualizar la lista correspondiente aquí.
// Devuelve un objeto nuevo solo con los campos conocidos, o null si
// algo no es válido.
// ============================================================
import type { RespuestasWizard } from "./scoringEngine";

const ETAPAS = ["aun_no_vendo", "vendo_presencial", "vendo_y_crezco", "vendo_y_ordeno"] as const;
const TIPOS_PRODUCTO = ["Productos Físicos", "Productos Frágiles", "Servicios"] as const;
const CANTIDADES = ["1-10", "11-50", "+50"] as const;
const PRESUPUESTOS = ["$0", "hasta $25.000", "+$25.000"] as const;
const ZONAS = ["Local", "Regional", "Nacional"] as const;
const URGENCIAS = ["baja", "media", "alta"] as const;
const VOLUMENES = ["0-200mil", "200mil-684mil", "684mil-1890mil", "+1890mil"] as const;

function esUno<T extends string>(valor: unknown, permitidos: readonly T[]): valor is T {
  return typeof valor === "string" && (permitidos as readonly string[]).includes(valor);
}

export function validarRespuestas(entrada: unknown): RespuestasWizard | null {
  if (typeof entrada !== "object" || entrada === null) return null;
  const r = entrada as Record<string, unknown>;

  const etapa = r.etapaEmprendimiento;
  const tipo = r.tipoProducto;
  const cantidad = r.cantidadProductos;
  const presupuesto = r.presupuestoMensual;
  const zona = r.zonaDespacho;
  const urgencia = r.urgenciaEnvio;
  const volumen = r.volumenMensual;

  if (
    !esUno(etapa, ETAPAS) ||
    !esUno(tipo, TIPOS_PRODUCTO) ||
    !esUno(cantidad, CANTIDADES) ||
    !esUno(presupuesto, PRESUPUESTOS) ||
    !esUno(zona, ZONAS) ||
    !esUno(urgencia, URGENCIAS) ||
    !esUno(volumen, VOLUMENES)
  ) {
    return null;
  }

  return {
    etapaEmprendimiento: etapa,
    tipoProducto: tipo,
    cantidadProductos: cantidad,
    presupuestoMensual: presupuesto,
    zonaDespacho: zona,
    urgenciaEnvio: urgencia,
    volumenMensual: volumen,
  };
}