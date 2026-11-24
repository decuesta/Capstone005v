// ============================================================
// app/components/PantallaEspera.tsx
// Pantalla que se muestra mientras el sistema calcula el diagnóstico.
// Muestra un consejo para emprendedores sobre el título (cambia cada 8
// segundos, en orden aleatorio y sin repetirse hasta haber mostrado
// todos) y, si la espera pasa de 20 segundos, un aviso de que está
// tardando un poco más de lo normal.
// No nombra ninguna herramienta ni proveedor de IA: habla de "nuestro
// sistema". Los consejos son generales y atemporales (sin plazos, montos
// ni normas) y no favorecen a ninguna plataforma ni transportista.
// ============================================================
"use client";

import { useEffect, useState } from "react";

const CONSEJOS: string[] = [
  "Antes de invertir en publicidad, pregunta a tres clientes por qué te compraron: te dirán qué destacar.",
  "Un buen precio incluye tu tiempo, el envío y las comisiones, no solo el costo del producto.",
  "Una foto clara y con buena luz transmite más confianza que una muy producida.",
  "Responder rápido a tus clientes mejora tu imagen, incluso si aún no tienes la respuesta completa.",
  "Anota cada venta y cada gasto desde el primer día: ordenar después cuesta mucho más.",
  "Pide a tus clientes contentos que te recomienden: el boca a boca sigue siendo muy poderoso.",
  "Parte con pocos productos bien resueltos antes de ampliar el catálogo.",
  "Sé honesto con tus plazos de entrega: prometer menos y cumplir genera confianza.",
  "Guarda los datos de tus clientes solo con su consentimiento, y úsalos para atenderlos mejor.",
  "Separa el dinero del negocio del dinero personal, aunque sea con dos cuentas simples.",
  "Revisa cada cierto tiempo tus costos de envío: pequeñas diferencias se suman en cada venta.",
  "Pregunta qué piensan tus clientes de tu empaque: la primera impresión comienza al abrir el paquete.",
];

const SEGUNDOS_POR_CONSEJO = 8;
const SEGUNDOS_AVISO_DEMORA = 20;

// Mezcla imparcial (Fisher-Yates). Devuelve una copia.
function mezclar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export default function PantallaEspera() {
  // Orden de los consejos, decidido una vez al abrir la pantalla.
  const [orden] = useState<string[]>(() => mezclar(CONSEJOS));
  const [segundos, setSegundos] = useState<number>(0);

  useEffect(() => {
    const reloj = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(reloj);
  }, []);

  const consejo = orden[Math.floor(segundos / SEGUNDOS_POR_CONSEJO) % orden.length];
  const hayDemora = segundos >= SEGUNDOS_AVISO_DEMORA;

  return (
    <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Consejo para emprendedores</p>
        <p className="text-sm text-slate-700" aria-live="off">
          {consejo}
        </p>
      </div>

      <div className="space-y-4" role="status">
        <div
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"
          aria-hidden="true"
        ></div>
        <h2 className="text-2xl font-bold text-slate-900">Estamos preparando tu diagnóstico...</h2>
        <p className="text-sm text-slate-500">
          Nuestro sistema está calculando tu plataforma y tu transportista, y redactando tu Modelo Canvas.
        </p>
        {hayDemora && (
          <p className="text-sm font-semibold text-amber-700">
            Esto está tardando un poco más de lo normal. Ya casi terminamos.
          </p>
        )}
      </div>
    </div>
  );
}