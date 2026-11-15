import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Configuración estándar de TanStack Start (sin dependencias de plataformas externas).
// Nitro detecta el proveedor al compilar (Vercel, Netlify, Cloudflare…) o genera un servidor Node.
export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // El servidor usa src/server.ts como envoltorio con manejo de errores SSR.
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
  ],
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"] },
  optimizeDeps: { include: ["use-sync-external-store/shim/with-selector", "maplibre-gl", "echarts"] },
});
