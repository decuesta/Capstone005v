// ============================================================
// app/admin/transportistas/AvisoVigencia.tsx
// RF-32: avisa al administrador cuando un tarifario lleva demasiado
// tiempo sin verificarse. Los transportistas reajustan sus tarifas
// cada mes según el IPC, por eso el límite es de 30 días.
// Se calcula en el momento: no guarda nada en la base.
// La antigüedad se mide con la fila MÁS ANTIGUA de cada transportista.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";

// Ajustables desde aquí, sin tocar el resto.
export const LIMITE_DIAS = 30;        // pasado este plazo, el tarifario está vencido
export const AVISO_PREVIO_DIAS = 7;   // avisa esta cantidad de días antes del límite

type Estado = "por_revisar" | "vencido";

interface Aviso {
  id: string;
  nombre: string;
  dias: number;
  estado: Estado;
}

// "2026-09-28" se interpreta como fecha local, sin desfase por zona horaria.
function diasDesdeFecha(fechaISO: string): number {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const hoy = new Date();
  const msHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const msFecha = Date.UTC(a, m - 1, d);
  return Math.round((msHoy - msFecha) / 86_400_000);
}

export default function AvisoVigencia() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [errorCarga, setErrorCarga] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      const { data: tarifas, error: e1 } = await supabase
        .from("tarifas_transporte")
        .select("courier_option_id, fecha_vigencia");
      const { data: opciones, error: e2 } = await supabase
        .from("scoring_option")
        .select("id, nombre");

      if (!activo) return;
      if (e1 || e2 || !tarifas || !opciones) {
        setErrorCarga(true);
        return;
      }

      // Fecha más antigua por transportista.
      const masAntigua = new Map<string, string>();
      for (const t of tarifas) {
        if (!t.fecha_vigencia) continue;
        const actual = masAntigua.get(t.courier_option_id);
        if (!actual || t.fecha_vigencia < actual) {
          masAntigua.set(t.courier_option_id, t.fecha_vigencia);
        }
      }

      const nombres = new Map(opciones.map((o) => [o.id as string, o.nombre as string]));
      const lista: Aviso[] = [];
      for (const [id, fecha] of masAntigua) {
        const dias = diasDesdeFecha(fecha);
        let estado: Estado | null = null;
        if (dias > LIMITE_DIAS) estado = "vencido";
        else if (dias >= LIMITE_DIAS - AVISO_PREVIO_DIAS) estado = "por_revisar";
        if (estado) lista.push({ id, nombre: nombres.get(id) ?? "Transportista", dias, estado });
      }
      lista.sort((a, b) => b.dias - a.dias);
      setAvisos(lista);
    }

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  if (errorCarga) {
    return (
      <div style={{ padding: "12px 16px", borderRadius: 8, background: "#fff7e6", border: "1px solid #f5c26b", marginBottom: 16 }}>
        No se pudo comprobar la vigencia de los tarifarios.
      </div>
    );
  }

  if (avisos.length === 0) return null;

  return (
    <div style={{ marginBottom: 16, display: "grid", gap: 8 }}>
      {avisos.map((a) => {
        const vencido = a.estado === "vencido";
        return (
          <div
            key={a.id}
            role="alert"
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              background: vencido ? "#fdecea" : "#fff7e6",
              border: `1px solid ${vencido ? "#e5534b" : "#f5c26b"}`,
              color: "#222",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              <strong>{a.nombre}</strong>:{" "}
              {vencido
                ? `tarifario vencido, sin verificar hace ${a.dias} días (límite ${LIMITE_DIAS}).`
                : `tarifario por revisar, sin verificar hace ${a.dias} días. Vence en ${LIMITE_DIAS - a.dias} días.`}
            </span>
            <Link href="/admin/transportistas" style={{ fontWeight: 600, textDecoration: "underline" }}>
              Revisar tarifario
            </Link>
          </div>
        );
      })}
    </div>
  );
}