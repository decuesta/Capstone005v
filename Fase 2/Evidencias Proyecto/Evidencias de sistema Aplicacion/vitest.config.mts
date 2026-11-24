// ============================================================
// vitest.config.mts
// Configuración de las pruebas unitarias (npm test). Solo corre los
// archivos de tests/unit: no se conecta a Supabase ni a la IA.
// La cobertura (npm run test:cobertura) se mide sobre utils/.
// ============================================================
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["utils/scoringEngine.ts", "utils/validarRespuestas.ts"],
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
  },
});
