// ============================================================
// app/api/exportar-pdf/route.ts
// Genera y devuelve el PDF del diagnóstico (solo PDF, sin edición: el
// Canvas es de solo lectura en la plataforma). Recibe el
// ResultadoDiagnostico ya calculado por generarDiagnostico(); no vuelve a
// calcular nada ni consulta la base de datos, y por eso no comprueba la
// sesión: pedir una cuenta para descargar es un incentivo de registro
// que aplica la pantalla, no una protección de datos.
// Incluye el fundamento de cada recomendación (RF-08). Los diagnósticos
// guardados antes de que existiera el fundamento no lo traen: en ese caso
// simplemente se omite.
// ============================================================
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ResultadoDiagnostico } from "@/app/actions/generateCanvas";
import { obtenerTextoPorQueDarElPaso } from "@/utils/porQueDarElPaso";
import { getSupabaseAdmin } from "@/utils/supabaseAdmin";

const MARGEN = 50;
const ANCHO_PAGINA = 595; // A4 en puntos
const ALTO_PAGINA = 842;
const ANCHO_TEXTO = ANCHO_PAGINA - MARGEN * 2;

// Parte un texto en líneas que caben dentro del ancho disponible,
// ya que pdf-lib no hace salto de línea automático.
function partirEnLineas(texto: string, font: PDFFont, tamano: number, anchoMaximo: number): string[] {
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let lineaActual = "";

  for (const palabra of palabras) {
    const intento = lineaActual ? `${lineaActual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(intento, tamano) > anchoMaximo && lineaActual) {
      lineas.push(lineaActual);
      lineaActual = palabra;
    } else {
      lineaActual = intento;
    }
  }
  if (lineaActual) lineas.push(lineaActual);
  return lineas;
}

export async function POST(request: Request) {
  const resultado: ResultadoDiagnostico = await request.json();

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  let y = ALTO_PAGINA - MARGEN;

  // Crea una página nueva si no queda espacio suficiente antes de
  // seguir escribiendo (evita que el texto se corte entre páginas).
  function asegurarEspacio(alturaNecesaria: number) {
    if (y - alturaNecesaria < MARGEN) {
      page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
      y = ALTO_PAGINA - MARGEN;
    }
  }

  function escribirTitulo(texto: string, tamano = 18) {
    asegurarEspacio(tamano + 10);
    page.drawText(texto, { x: MARGEN, y, size: tamano, font: fontBold, color: rgb(0.12, 0.22, 0.39) });
    y -= tamano + 10;
  }

  function escribirSubtitulo(texto: string, tamano = 12) {
    asegurarEspacio(tamano + 8);
    page.drawText(texto, { x: MARGEN, y, size: tamano, font: fontBold, color: rgb(0, 0, 0) });
    y -= tamano + 6;
  }

  function escribirParrafo(texto: string, tamano = 10) {
    const lineas = partirEnLineas(texto, fontRegular, tamano, ANCHO_TEXTO);
    for (const linea of lineas) {
      asegurarEspacio(tamano + 4);
      page.drawText(linea, { x: MARGEN, y, size: tamano, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
      y -= tamano + 4;
    }
    y -= 6;
  }

  // --- Encabezado ---
  escribirTitulo("E-Match — Tu Diagnóstico");
  escribirParrafo(`Generado el ${new Date().toLocaleDateString("es-CL")}.`, 9);

  // --- Recomendación de plataforma ---
  if (resultado.sinRecomendacionPlataforma) {
    escribirSubtitulo("Aún no es momento de una plataforma formal");
    escribirParrafo(resultado.motivoSinRecomendacion ?? "");
    escribirParrafo("Te sugerimos partir con WhatsApp Business o Instagram Shopping.");
  } else if (resultado.plataforma) {
    escribirSubtitulo("Plataforma recomendada");
    escribirParrafo(`${resultado.plataforma.nombre} — Puntaje de ajuste: ${resultado.plataforma.puntaje}/100`);
    if (resultado.plataforma.fundamento) escribirParrafo(resultado.plataforma.fundamento);
    if (resultado.esServicio) {
      escribirParrafo(
        "Es una tienda online: antes de contratar, revisa en su sitio qué funciones de reservas o agenda ofrece según el plan.",
        8
      );
    }
  }

  // --- Recomendación de courier ---
  if (resultado.courier) {
    escribirSubtitulo("Transportista recomendado");
    escribirParrafo(`${resultado.courier.nombre} — Puntaje de ajuste: ${resultado.courier.puntaje}/100`);
    if (resultado.courier.fundamento) escribirParrafo(resultado.courier.fundamento);
  }

  // --- Costo estimado ---
  if (resultado.costoEstimado) {
    const c = resultado.costoEstimado;
    escribirSubtitulo("Costo mensual estimado");
    escribirParrafo(`Plan ${c.plan}: $${c.precioPlan.toLocaleString("es-CL")}`);
    escribirParrafo(`Comisión estimada: $${c.comisionEstimada.toLocaleString("es-CL")}`);
    if (c.costoEnvio !== null) {
      escribirParrafo(`Envío (referencia 3 kg): $${c.costoEnvio.toLocaleString("es-CL")}`);
    }
    escribirParrafo(`Total estimado: $${c.totalEstimado.toLocaleString("es-CL")}`, 11);
    if (c.esEstimacionMinima) {
      escribirParrafo("Estimación mínima: tu volumen de ventas puede ser mayor al usado en este cálculo.", 8);
    }
    escribirParrafo(
      `${c.costoEnvio !== null ? "Tarifario" : "Precios"} vigente al ${c.fechaVigenciaTarifa}. Estimación referencial, no vinculante.`,
      8
    );
  }

  // --- Por qué dar el paso ---
  const porQue = obtenerTextoPorQueDarElPaso({
    etapa: resultado.etapa,
    esServicio: resultado.esServicio,
    sinRecomendacionPlataforma: resultado.sinRecomendacionPlataforma,
  });
  escribirSubtitulo(porQue.titulo);
  for (const punto of porQue.puntos) escribirParrafo(`- ${punto}`);
  escribirParrafo(porQue.nota, 8);

  // --- Business Model Canvas ---
  escribirTitulo("Tu Business Model Canvas", 14);
  const bloques: [string, string][] = [
    ["Propuesta de valor", resultado.canvas.propuestaValor],
    ["Segmento de clientes", resultado.canvas.segmentoClientes],
    ["Canales", resultado.canvas.canales],
    ["Relación con clientes", resultado.canvas.relacionClientes],
    ["Fuentes de ingreso", resultado.canvas.fuentesIngreso],
    ["Recursos clave", resultado.canvas.recursosClave],
    ["Actividades clave", resultado.canvas.actividadesClave],
    ["Socios clave", resultado.canvas.sociosClave],
    ["Estructura de costos", resultado.canvas.estructuraCostos],
  ];
  for (const [titulo, contenido] of bloques) {
    escribirSubtitulo(titulo);
    escribirParrafo(contenido);
  }

  if (!resultado.generadoPorIA) {
    escribirParrafo("Este Canvas fue generado con una plantilla de respaldo (la IA no estuvo disponible en este momento).", 8);
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);

    // RF-20: deja registrada la descarga (una por diagnóstico; la base ignora
  // las repetidas). Si falla, el PDF se entrega igual. Restaura lo agregado
  // en PR23 y perdido en PR31.
  if (typeof resultado.diagnosticoId === "string") {
    try {
      const { error } = await getSupabaseAdmin().rpc("registrar_evento_uso", {
        p_diagnostico_id: resultado.diagnosticoId,
        p_tipo: "descarga_pdf",
      });
      if (error) console.error("No se pudo registrar la descarga del PDF:", error.message);
    } catch (e) {
      console.error("No se pudo registrar la descarga del PDF:", e);
    }
  }

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="diagnostico-e-match.pdf"',
    },
  });
}