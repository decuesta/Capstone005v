// ============================================================
// app/admin/dashboard/page.tsx
// RF-20: dashboard de KPIs para el administrador.
// Un solo llamado a obtener_kpis(p_dias). La protección real está en la
// base: la función exige ser administrador. Esta pantalla solo muestra
// lo que la función entrega.
// Los clics se cuentan por diagnóstico (uno por diagnóstico y opción), y
// el paso a paso y el PDF también: son "diagnósticos que...", no
// repeticiones.
// ============================================================
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";

interface ProveedorIA {
  respondio: number;
  fallo: number;
  motivos: Record<string, number>;
}

interface Kpis {
  periodo_dias: number | null;
  diagnosticos: { total: number; con_ia: number; con_respaldo: number; sin_dato_proveedor: number };
  cuentas_creadas: number;
  clics: { plataformas: number; transportistas: number };
  contactos_agencia: number;
  paso_a_paso_iniciado: number;
  descargas_pdf: number;
  ia: { gemini: ProveedorIA; nvidia: ProveedorIA; bloqueados_por_tope: number };
}

const PERIODOS: { etiqueta: string; dias: number | null }[] = [
  { etiqueta: "Últimos 7 días", dias: 7 },
  { etiqueta: "Últimos 30 días", dias: 30 },
  { etiqueta: "Todo el historial", dias: null },
];

function porcentaje(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)} %`;
}

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: number | string; detalle?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1">{valor}</p>
      {detalle && <p className="text-xs text-slate-500 mt-1">{detalle}</p>}
    </div>
  );
}

function FilaProveedor({ nombre, datos }: { nombre: string; datos: ProveedorIA }) {
  const intentos = datos.respondio + datos.fallo;
  const motivos = Object.entries(datos.motivos).sort((a, b) => b[1] - a[1]);
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-6 py-4 font-semibold text-slate-900">{nombre}</td>
      <td className="px-6 py-4">{intentos}</td>
      <td className="px-6 py-4">{datos.respondio}</td>
      <td className="px-6 py-4">{datos.fallo}</td>
      <td className="px-6 py-4 font-semibold">{porcentaje(datos.respondio, intentos)}</td>
      <td className="px-6 py-4 text-xs text-slate-600">
        {motivos.length === 0
          ? "—"
          : motivos.map(([clave, n]) => `${clave.split(":")[1] ?? clave} ×${n}`).join(" · ")}
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const [dias, setDias] = useState<number | null>(30);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (periodo: number | null) => {
    setCargando(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("obtener_kpis", { p_dias: periodo });
    if (e) {
      console.error("No se pudieron cargar los KPIs:", e.message);
      const sinAcceso = e.code === "42501" || /permission denied|No autorizado/i.test(e.message);
      setError(
        sinAcceso
          ? "No tienes acceso a esta sección. Inicia sesión con una cuenta de administrador."
          : "No pudimos cargar los indicadores. Intenta de nuevo más tarde."
      );
      setKpis(null);
    } else {
      setKpis(data as Kpis);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar(dias);
  }, [dias, cargar]);

  const intentosGemini = kpis ? kpis.ia.gemini.respondio + kpis.ia.gemini.fallo : 0;
  const intentosNvidia = kpis ? kpis.ia.nvidia.respondio + kpis.ia.nvidia.fallo : 0;
  const total = kpis?.diagnosticos.total ?? 0;

  let masRespondio = "—";
  if (kpis) {
    const g = kpis.ia.gemini.respondio;
    const n = kpis.ia.nvidia.respondio;
    if (g === 0 && n === 0) masRespondio = "Sin datos todavía";
    else if (g === n) masRespondio = "Empate";
    else masRespondio = g > n ? "Gemini" : "NVIDIA";
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
              ← Panel de administración
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Dashboard</h1>
            <p className="text-sm text-slate-500">Indicadores de uso de E-Match.</p>
          </div>
          <div className="flex gap-2">
            {PERIODOS.map((p) => (
              <button
                key={p.etiqueta}
                onClick={() => setDias(p.dias)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                  dias === p.dias
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
        </header>

        {cargando && <p className="text-sm text-slate-500">Cargando...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {kpis && !cargando && (
          <>
            <section className="space-y-3">
              <h2 className="font-semibold text-slate-900">Uso</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Tarjeta
                  titulo="Diagnósticos"
                  valor={kpis.diagnosticos.total}
                  detalle={`${kpis.diagnosticos.con_ia} con IA · ${kpis.diagnosticos.con_respaldo} con plantilla`}
                />
                <Tarjeta titulo="Cuentas creadas" valor={kpis.cuentas_creadas} />
                <Tarjeta
                  titulo="Iniciaron el paso a paso"
                  valor={kpis.paso_a_paso_iniciado}
                  detalle={`${porcentaje(kpis.paso_a_paso_iniciado, total)} de los diagnósticos`}
                />
                <Tarjeta
                  titulo="Descargaron el PDF"
                  valor={kpis.descargas_pdf}
                  detalle={`${porcentaje(kpis.descargas_pdf, total)} de los diagnósticos`}
                />
                <Tarjeta
                  titulo="Clic en plataformas"
                  valor={kpis.clics.plataformas}
                  detalle="Diagnósticos con al menos un clic"
                />
                <Tarjeta
                  titulo="Clic en transportistas"
                  valor={kpis.clics.transportistas}
                  detalle="Diagnósticos con al menos un clic"
                />
                <Tarjeta titulo="Contactos con agencias" valor={kpis.contactos_agencia} />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold text-slate-900">Inteligencia artificial por proveedor</h2>
              <p className="text-sm text-slate-600">
                Responde más: <strong>{masRespondio}</strong>. La tasa es respuestas válidas sobre intentos reales
                de ese proveedor.
              </p>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Proveedor</th>
                      <th className="px-6 py-3">Intentos</th>
                      <th className="px-6 py-3">Respondió</th>
                      <th className="px-6 py-3">Falló</th>
                      <th className="px-6 py-3">Tasa de éxito</th>
                      <th className="px-6 py-3">Motivos de fallo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <FilaProveedor nombre="Gemini" datos={kpis.ia.gemini} />
                    <FilaProveedor nombre="NVIDIA" datos={kpis.ia.nvidia} />
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                {intentosGemini + intentosNvidia === 0 && "Aún no hay intentos de IA en este período. "}
                Bloqueados por tope de uso: {kpis.ia.bloqueados_por_tope}. Diagnósticos sin dato de proveedor
                (anteriores al registro): {kpis.diagnosticos.sin_dato_proveedor}.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}