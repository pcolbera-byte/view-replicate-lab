// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      // Importação do Mais Corret (mdb-reader): troca a criptografia (só usada em Access com senha)
      // por módulos vazios, evitando polyfills do Node no navegador.
      alias: [
        // Pacote "buffer" (npm) com nome próprio, para o Vite não trocá-lo pelo módulo nativo do Node.
        {
          find: /^buffer-polyfill$/,
          replacement: createRequire(import.meta.url).resolve("buffer/"),
        },
        {
          find: /^browserify-aes\/browser\.js$/,
          replacement: fileURLToPath(
            new URL("./src/lib/shims/access-crypto-stub.ts", import.meta.url),
          ),
        },
        {
          find: /^create-hash$/,
          replacement: fileURLToPath(
            new URL("./src/lib/shims/access-hash-stub.ts", import.meta.url),
          ),
        },
      ],
    },
  },
});
