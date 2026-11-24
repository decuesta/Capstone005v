// ============================================================
// app/manifest.ts
// Manifiesto de la PWA (RF-23): permite instalar E-Match en el celular o
// el computador. Next.js lo publica en /manifest.webmanifest.
// ============================================================
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "E-Match",
    short_name: "E-Match",
    description:
      "Diagnóstico para emprendedores chilenos: plataforma de e-commerce y transportista sugeridos para tu negocio.",
    lang: "es-CL",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#2563EB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
