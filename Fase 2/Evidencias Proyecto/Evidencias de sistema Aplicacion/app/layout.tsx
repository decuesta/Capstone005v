import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegistrarServiceWorker from "./components/RegistrarServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "E-Match",
  description:
    "Diagnóstico para emprendedores chilenos: plataforma de e-commerce y transportista sugeridos para tu negocio.",
  applicationName: "E-Match",
  // PWA (RF-23): en iPhone, ícono y nombre al añadir a la pantalla de inicio.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "E-Match", statusBarStyle: "default" },
};

// Color de la barra del navegador en el celular (PWA, RF-23).
export const viewport: Viewport = {
  themeColor: "#2563EB",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
