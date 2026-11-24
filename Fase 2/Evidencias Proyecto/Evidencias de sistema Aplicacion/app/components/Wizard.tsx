"use client";

import { useState } from "react";
import type { RespuestasWizard } from "@/utils/scoringEngine";

interface WizardProps {
  onComplete: (data: RespuestasWizard) => void;
  onCancel: () => void;
}

// Pasos que se muestran según las respuestas ya dadas:
// - Quien declara "aún no vendo" no tiene ventas que estimar: se omite el paso 4
//   (volumen de ventas) y se asigna el tramo más bajo, que sigue siendo un valor
//   válido para el servidor (validarRespuestas.ts) y para el cálculo de costos.
// - Quien ofrece servicios no despacha nada: se omiten los pasos 5 (cobertura de
//   despacho) y 6 (urgencia de envío). Al terminar se asignan valores neutros
//   (Local / media), que no activan ninguna regla de ajuste de pesos y siguen
//   siendo válidos para el servidor. El servidor no recomienda transportista.
function pasosVisibles(r: Partial<RespuestasWizard>): number[] {
  const pasos = [1, 2, 3];
  if (r.etapaEmprendimiento !== "aun_no_vendo") pasos.push(4);
  if (r.tipoProducto !== "Servicios") pasos.push(5, 6);
  pasos.push(7);
  return pasos;
}

export default function Wizard({ onComplete, onCancel }: WizardProps) {
  const [paso, setPaso] = useState<number>(1);
  const [respuestas, setRespuestas] = useState<Partial<RespuestasWizard>>({});

  const visibles = pasosVisibles(respuestas);
  const totalMostrado = visibles.length;
  const numeroMostrado = Math.max(visibles.indexOf(paso) + 1, 1);

  // Manejador de selección para avanzar automáticamente.
  const seleccionarOpcion = <K extends keyof RespuestasWizard>(campo: K, valor: RespuestasWizard[K]) => {
    const nuevasRespuestas: Partial<RespuestasWizard> = { ...respuestas, [campo]: valor };
    // Al elegir "aún no vendo" se fija el tramo más bajo, aunque antes hubiera
    // contestado otro valor y haya vuelto atrás a cambiar la etapa.
    if (campo === "etapaEmprendimiento" && valor === "aun_no_vendo") {
      nuevasRespuestas.volumenMensual = "0-200mil";
    }
    setRespuestas(nuevasRespuestas);

    // El siguiente paso se calcula con las respuestas nuevas: elegir "Servicios"
    // o "aún no vendo" cambia qué pasos quedan por delante.
    const siguientes = pasosVisibles(nuevasRespuestas);
    const posicion = siguientes.indexOf(paso);
    if (posicion < siguientes.length - 1) {
      setPaso(siguientes[posicion + 1]);
    } else {
      const finales: Partial<RespuestasWizard> = { ...nuevasRespuestas };
      if (finales.tipoProducto === "Servicios") {
        finales.zonaDespacho = "Local";
        finales.urgenciaEnvio = "media";
      }
      onComplete(finales as RespuestasWizard);
    }
  };

  return (
    <div className="max-w-2xl w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      {/* Barra de Progreso */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2 text-xs font-semibold text-slate-500">
          <span>PASO {numeroMostrado} DE {totalMostrado}</span>
          <span>{Math.round((numeroMostrado / totalMostrado) * 100)}% COMPLETADO</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${(numeroMostrado / totalMostrado) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* PASO 1: Tipo de producto o servicio */}
      {paso === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">1. ¿Qué tipo de producto o servicio ofreces?</h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => seleccionarOpcion("tipoProducto", "Productos Físicos")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              📦 Productos Físicos (Muebles, ropa, artesanía)
            </button>
            <button
              onClick={() => seleccionarOpcion("tipoProducto", "Productos Frágiles")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🍷 Productos Frágiles (Vidrio, alimentos, cerámica)
            </button>
            <button
              onClick={() => seleccionarOpcion("tipoProducto", "Servicios")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              💻 Servicios (Digitales, clases, consultoría)
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Etapa del emprendimiento — 4 valores reales del ENUM etapa_emprendimiento */}
      {paso === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">2. ¿En qué etapa está tu negocio?</h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => seleccionarOpcion("etapaEmprendimiento", "aun_no_vendo")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🌱 Aún no vendo
            </button>
            <button
              onClick={() => seleccionarOpcion("etapaEmprendimiento", "vendo_presencial")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🏪 Vendo en persona
            </button>
            <button
              onClick={() => seleccionarOpcion("etapaEmprendimiento", "vendo_y_crezco")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              📈 Ya vendo y quiero crecer
            </button>
            <button
              onClick={() => seleccionarOpcion("etapaEmprendimiento", "vendo_y_ordeno")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🗂️ Ya vendo pero necesito ordenar
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Presupuesto mensual — valores exactos del ENUM rango_presupuesto */}
      {paso === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">3. ¿Cuál es tu presupuesto mensual para tecnología?</h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => seleccionarOpcion("presupuestoMensual", "$0")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🌱 $0 (Busco alternativas 100% gratuitas)
            </button>
            <button
              onClick={() => seleccionarOpcion("presupuestoMensual", "hasta $25.000")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              💳 Hasta $25.000 / mes
            </button>
            <button
              onClick={() => seleccionarOpcion("presupuestoMensual", "+$25.000")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🚀 Más de $25.000 / mes
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: Volumen de ventas mensual */}
      {paso === 4 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">4. Aproximadamente, ¿cuánto vendes al mes hoy?</h2>
          <p className="text-sm text-slate-500 -mt-4">Es solo un rango aproximado, no necesitas un número exacto.</p>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => seleccionarOpcion("volumenMensual", "0-200mil")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              💵 Hasta $200.000
            </button>
            <button
              onClick={() => seleccionarOpcion("volumenMensual", "200mil-684mil")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              💵 Entre $200.000 y $684.000
            </button>
            <button
              onClick={() => seleccionarOpcion("volumenMensual", "684mil-1890mil")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              💵 Entre $684.000 y $1.890.000
            </button>
            <button
              onClick={() => seleccionarOpcion("volumenMensual", "+1890mil")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              💵 Más de $1.890.000
            </button>
          </div>
        </div>
      )}

      {/* PASO 5: Zona de despacho — el valor "Nacional" debe coincidir con equivalencia_zona_courier */}
      {paso === 5 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">{numeroMostrado}. ¿Cuál es tu cobertura de despacho principal?</h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => seleccionarOpcion("zonaDespacho", "Local")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              📍 Local (Solo en mi ciudad / comuna)
            </button>
            <button
              onClick={() => seleccionarOpcion("zonaDespacho", "Regional")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🗺️ Regional (Misma región)
            </button>
            <button
              onClick={() => seleccionarOpcion("zonaDespacho", "Nacional")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🇨🇱 Todo Chile
            </button>
          </div>
        </div>
      )}

      {/* PASO 6: Urgencia de envío — 3 valores reales del ENUM urgencia_envio */}
      {paso === 6 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">{numeroMostrado}. ¿Qué tan urgente necesitas que lleguen tus envíos?</h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => seleccionarOpcion("urgenciaEnvio", "baja")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🐢 Sin apuro, prefiero pagar menos
            </button>
            <button
              onClick={() => seleccionarOpcion("urgenciaEnvio", "media")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🚚 Rapidez media
            </button>
            <button
              onClick={() => seleccionarOpcion("urgenciaEnvio", "alta")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              ⚡ Necesito que llegue rápido
            </button>
          </div>
        </div>
      )}

      {/* PASO 7: Cantidad de productos — 3 valores reales del ENUM rango_productos.
          Solo "+50" tiene regla de ajuste cargada en scoring_weight_rule (sube
          el peso de "Volumen y escalabilidad" en +10); los otros dos valores
          no ajustan ningún peso — es el comportamiento esperado, no un hueco. */}
      {paso === 7 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">{numeroMostrado}. ¿Cuántos productos o servicios distintos ofreces?</h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => seleccionarOpcion("cantidadProductos", "1-10")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🔹 Entre 1 y 10
            </button>
            <button
              onClick={() => seleccionarOpcion("cantidadProductos", "11-50")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🔸 Entre 11 y 50
            </button>
            <button
              onClick={() => seleccionarOpcion("cantidadProductos", "+50")}
              className="p-4 text-left border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all font-medium text-slate-700"
            >
              🔶 Más de 50
            </button>
          </div>
        </div>
      )}

      {/* Botones de navegación inferior */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center">
        {paso > 1 ? (
          <button
            onClick={() => setPaso(visibles[Math.max(visibles.indexOf(paso) - 1, 0)])}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Paso anterior
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}