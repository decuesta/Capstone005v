// ============================================================
// app/components/PorQueDarElPaso.tsx
// Recuadro "Ahora lo explicamos con peras y manzanas" del plan paso a paso.
// El texto sale de utils/porQueDarElPaso.ts (el mismo que usa el PDF).
// ============================================================
import type { ResultadoDiagnostico } from "@/app/actions/generateCanvas";
import { obtenerTextoPorQueDarElPaso } from "@/utils/porQueDarElPaso";

export default function PorQueDarElPaso({ resultado }: { resultado: ResultadoDiagnostico }) {
  const texto = obtenerTextoPorQueDarElPaso({
    etapa: resultado.etapa,
    esServicio: resultado.esServicio,
    sinRecomendacionPlataforma: resultado.sinRecomendacionPlataforma,
  });

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h3 className="font-semibold text-slate-900">{texto.titulo}</h3>
      <ul className="mt-2 space-y-2 text-sm text-slate-700 list-disc pl-5">
        {texto.puntos.map((punto) => (
          <li key={punto}>{punto}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">{texto.nota}</p>
    </div>
  );
}
