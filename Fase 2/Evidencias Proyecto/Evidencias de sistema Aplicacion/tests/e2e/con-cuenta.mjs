// ============================================================
// tests/e2e/con-cuenta.mjs
// Ejecuta las pruebas de punta a punta CON la cuenta de emprendedor de
// prueba (para que también descarguen el PDF), sin escribir la contraseña
// en la línea de comandos: la pide en la terminal sin mostrarla y la pasa
// solo al proceso de Playwright. Así no queda en el historial de
// PowerShell ni en ningún archivo.
// Uso, desde la raíz del repositorio:  npm run test:e2e:cuenta
// ============================================================
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";

function preguntar(texto) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(texto, (r) => {
      rl.close();
      resolve(r.trim());
    });
  });
}

// Lee una contraseña sin mostrarla en pantalla.
function leerContrasena(texto) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error("Se necesita una terminal interactiva para escribir la contraseña."));
      return;
    }
    process.stdout.write(texto);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let clave = "";
    const terminar = () => {
      stdin.removeListener("data", alRecibir);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const alRecibir = (teclas) => {
      for (const c of teclas) {
        if (c === "\r" || c === "\n") {
          terminar();
          resolve(clave);
          return;
        }
        if (c === "\u0003") {
          terminar();
          reject(new Error("Cancelado."));
          return;
        }
        if (c === "\u0008" || c === "\u007f") {
          clave = clave.slice(0, -1);
        } else {
          clave += c;
        }
      }
    };
    stdin.on("data", alRecibir);
  });
}

try {
  const correo = await preguntar("Correo de la cuenta de emprendedor de prueba: ");
  const clave = await leerContrasena("Contraseña (no se muestra): ");
  if (!correo || !clave) throw new Error("Faltan el correo o la contraseña.");

  const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
  const hijo = spawn(process.execPath, [cli, "test", "tests/e2e/flujo.spec.ts"], {
    stdio: "inherit",
    env: { ...process.env, E2E_CORREO: correo, E2E_CLAVE: clave },
  });
  hijo.on("exit", (codigo) => process.exit(codigo ?? 1));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
