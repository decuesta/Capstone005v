// ============================================================
// utils/porQueDarElPaso.ts
// Texto fijo "Ahora lo explicamos con peras y manzanas": por qué conviene
// dar el paso (tienda propia, formalización, venderle a empresas, fondos).
// Es texto escrito por el equipo y revisado contra fuentes oficiales
// (SII, Sercotec); no pasa por la IA, así que no puede inventar nada.
// Se usa en el plan paso a paso y en el PDF, para que ambos digan lo mismo.
// Orientación general: no reemplaza al SII ni a un contador.
// Las bases de los fondos cambian cada año: revisar este texto una vez al año.
// ============================================================

export const TITULO_POR_QUE_DAR_EL_PASO = "Ahora lo explicamos con peras y manzanas";

export const NOTA_POR_QUE_DAR_EL_PASO =
  "Orientación general. Confirma tu caso con el SII o un contador, y revisa las bases del año vigente.";

export interface TextoPorQueDarElPaso {
  titulo: string;
  puntos: string[];
  nota: string;
}

type Grupo = "aun_no_vendo" | "vendo_presencial" | "vendo_y_crece";

// Las cuatro etapas del Wizard se agrupan en tres escenarios.
// Los diagnósticos guardados antes de este cambio no traen la etapa: si no
// hubo plataforma sugerida se trata como "aún no vendo", y si no, como
// "vendo en persona o por redes" (el texto más general).
function grupoDeEtapa(etapa: string | undefined, sinRecomendacionPlataforma: boolean): Grupo {
  if (etapa === "aun_no_vendo") return "aun_no_vendo";
  if (etapa === "vendo_presencial") return "vendo_presencial";
  if (etapa === "vendo_y_crezco" || etapa === "vendo_y_ordeno") return "vendo_y_crece";
  return sinRecomendacionPlataforma ? "aun_no_vendo" : "vendo_presencial";
}

export function obtenerTextoPorQueDarElPaso(params: {
  etapa?: string;
  esServicio?: boolean;
  sinRecomendacionPlataforma?: boolean;
}): TextoPorQueDarElPaso {
  const servicio = params.esServicio === true;
  const grupo = grupoDeEtapa(params.etapa, params.sinRecomendacionPlataforma === true);

  // Los servicios hablan de "página con reservas" en vez de "tienda".
  const tiendaPropia = servicio ? "una página propia con reservas" : "una tienda propia";
  const lo_que_ofreces = servicio ? "servicio" : "producto";

  let puntos: string[];

  if (grupo === "aun_no_vendo") {
    puntos = [
      `Partir sin tienda no es partir de cero. Con WhatsApp o Instagram ya puedes probar si a la gente le gusta tu ${lo_que_ofreces}, sin gastar en una plataforma.`,
      "Ojo con formalizarte demasiado pronto. Hay ayudas del Estado para negocios nuevos, como Capital Semilla de Sercotec, que en los últimos años ha dado hasta unos $3,5 millones. Piden que aún no hayas iniciado actividades en el SII (el trámite que te permite dar boletas y facturas). Si te eligen, lo haces recién ahí.",
      "El Canvas de este informe te sirve de borrador. Ese fondo pide un formulario Canvas que describe tu modelo de negocio, y el tuyo ya tiene los 9 bloques para empezar. Consulta otros requisitos en la documentación oficial del fondo o de la postulación.",
    ];
  } else if (grupo === "vendo_presencial") {
    puntos = [
      `Con ${tiendaPropia}, tu negocio tiene su dirección en internet. Te pueden encontrar buscando en Google, sin depender de que alguien vea tu publicación en Instagram.`,
      "Formalizarte te deja dar boleta y factura. Para eso necesitas el inicio de actividades en el SII.",
      "La factura te abre otra puerta: venderle a otras empresas, que normalmente la necesitan para sus compras.",
      "Si aún no iniciaste actividades, revisa fondos como Capital Semilla antes de hacerlo.",
    ];
  } else {
    puntos = [
      `${servicio ? "Una página propia con reservas" : "Una tienda propia"} trabaja por ti las 24 horas y deja tus ${servicio ? "reservas" : "ventas"} ordenadas en un solo lugar, en vez de repartidas en mensajes.`,
      "Con factura puedes venderle a empresas, no solo a personas. Las empresas suelen comprar más seguido y en mayor cantidad.",
      "Si todavía no estás formalizado, es el momento de hacerlo: sin el inicio de actividades en el SII no puedes emitir factura.",
    ];
  }

  return { titulo: TITULO_POR_QUE_DAR_EL_PASO, puntos, nota: NOTA_POR_QUE_DAR_EL_PASO };
}
