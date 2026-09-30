// Apelido definido em vite.config.ts para o pacote npm "buffer" (usado pelo leitor de Access no navegador).
declare module "buffer-polyfill" {
  export { Buffer } from "buffer";
}
