// ============================================================
// app/admin/agencias/utilidades.ts
// Tipos y funciones de apoyo del mantenedor de contactos con agencias
// (RF-13, modelo concierge: el administrador hace llegar cada contacto a
// la agencia). Se usan desde page.tsx y desde TarjetaContacto.tsx.
// ============================================================

// Una fila de listar_contactos_agencias(): lo que la persona aceptó
// compartir. No incluye el texto del Canvas ni el resultado completo.
export interface Contacto {
  contacto_id: string;
  fecha_contacto: string;
  agencia_id: string;
  agencia_nombre: string;
  agencia_es_demo: boolean;
  agencia_correo_contacto: string | null;
  reenviado: boolean;
  fecha_reenvio: string | null;
  correo: string | null;
  etapa: string | null;
  tipo_producto: string | null;
  cantidad_productos: string | null;
  presupuesto_mensual: string | null;
  zona_despacho: string | null;
  urgencia_envio: string | null;
  volumen_mensual: string | null;
  plataforma_sugerida: string | null;
  courier_sugerido: string | null;
}

export interface Mensaje {
  texto: string;
  tipo: "ok" | "error";
}

const ETAPAS: Record<string, string> = {
  aun_no_vendo: "Aún no vende",
  vendo_presencial: "Vende en persona",
  vendo_y_crezco: "Ya vende y quiere crecer",
  vendo_y_ordeno: "Ya vende pero necesita ordenar",
};

const URGENCIAS: Record<string, string> = {
  baja: "Baja (sin apuro)",
  media: "Media",
  alta: "Alta (necesita que llegue rápido)",
};

const VOLUMENES: Record<string, string> = {
  "0-200mil": "Hasta $200.000",
  "200mil-684mil": "Entre $200.000 y $684.000",
  "684mil-1890mil": "Entre $684.000 y $1.890.000",
  "+1890mil": "Más de $1.890.000",
};

const CANTIDADES: Record<string, string> = {
  "1-10": "Entre 1 y 10",
  "11-50": "Entre 11 y 50",
  "+50": "Más de 50",
};

const PRESUPUESTOS: Record<string, string> = {
  "$0": "$0",
  "hasta $25.000": "Hasta $25.000 al mes",
  "+$25.000": "Más de $25.000 al mes",
};

function legible(mapa: Record<string, string>, valor: string | null): string {
  if (!valor) return "—";
  return mapa[valor] ?? valor;
}

export const etapaLegible = (v: string | null) => legible(ETAPAS, v);
export const urgenciaLegible = (v: string | null) => legible(URGENCIAS, v);
export const volumenLegible = (v: string | null) => legible(VOLUMENES, v);
export const cantidadLegible = (v: string | null) => legible(CANTIDADES, v);
export const presupuestoLegible = (v: string | null) => legible(PRESUPUESTOS, v);

// Fecha y hora en formato chileno.
export function fechaHoraCL(fecha: string): string {
  return new Date(fecha).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Resumen de una línea para la tabla.
export function resumenCorto(c: Contacto): string {
  return [etapaLegible(c.etapa), c.tipo_producto ?? "—", c.zona_despacho ?? "—"].join(" · ");
}

// Texto listo para pegar en un correo o mensaje a la agencia. Incluye solo
// lo que la persona aceptó compartir.
export function textoParaAgencia(c: Contacto): string {
  return [
    `Hola, te escribo de parte de E-Match. Una persona quiere que ${c.agencia_nombre} la contacte.`,
    "",
    `Correo de contacto: ${c.correo ?? "(sin correo registrado)"}`,
    "",
    "Su diagnóstico:",
    `- Etapa: ${etapaLegible(c.etapa)}`,
    `- Tipo de producto o servicio: ${c.tipo_producto ?? "—"}`,
    `- Cantidad de productos: ${cantidadLegible(c.cantidad_productos)}`,
    `- Presupuesto mensual para tecnología: ${presupuestoLegible(c.presupuesto_mensual)}`,
    `- Ventas mensuales: ${volumenLegible(c.volumen_mensual)}`,
    `- Cobertura de despacho: ${c.zona_despacho ?? "—"}`,
    `- Urgencia de envío: ${urgenciaLegible(c.urgencia_envio)}`,
    `- Plataforma sugerida: ${c.plataforma_sugerida ?? "ninguna (aún no corresponde una plataforma formal)"}`,
    `- Transportista sugerido: ${c.courier_sugerido ?? "—"}`,
    "",
    `Solicitud del ${fechaHoraCL(c.fecha_contacto)}. La persona aceptó compartir estos datos con ${c.agencia_nombre} para que la contacte.`,
  ].join("\n");
}

// Una agencia con sus datos privados, tal como la entrega listar_agencias_admin().
export interface AgenciaAdmin {
  agencia_id: string;
  nombre: string;
  categoria_servicio: string;
  portafolio_url: string | null;
  estado: string;
  consentimiento_registrado: boolean;
  es_demo: boolean;
  es_afiliado: boolean;
  fecha_incorporacion: string | null;
  correo_contacto: string | null;
  nota_acuerdo: string | null;
  visible_publico: boolean;
}

export const CATEGORIAS_AGENCIA: Record<string, string> = {
  desarrollo_ecommerce: "Desarrollo de tienda online",
  asesoria_venta_social: "Asesoría de venta en redes",
  ambas: "Tienda online y redes",
};

// Misma regla de forma que usa la base de datos.
export function correoValido(texto: string): boolean {
  return texto.length > 0 && texto.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto);
}

// El portafolio se muestra a las personas: debe ser https y tener dominio.
export function enlaceValido(texto: string): boolean {
  if (texto.length === 0 || texto.length > 500) return false;
  try {
    const url = new URL(texto);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}