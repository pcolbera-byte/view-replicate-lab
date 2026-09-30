import type { CapacitorConfig } from "@capacitor/cli";

// Endereço publicado do app no Lovable (Publish). O aplicativo das lojas abre este endereço,
// então toda atualização publicada no Lovable chega aos celulares sem novo envio às lojas.
// Troque pelo seu domínio (ex.: https://app.corretor360.com.br) ou defina CORRETOR360_URL no Codemagic.
const url = process.env.CORRETOR360_URL ?? "https://SEU-PROJETO.lovable.app";

const config: CapacitorConfig = {
  // Identificador único nas lojas: não pode mudar depois da primeira publicação.
  appId: process.env.CORRETOR360_APP_ID ?? "br.com.corretor360.app",
  appName: "Corretor360",
  webDir: "www",
  server: {
    url,
    cleartext: false,
    // Páginas de erro/offline locais quando não houver internet.
    errorPath: "offline.html",
  },
  android: {
    backgroundColor: "#f2f8fc",
  },
  ios: {
    backgroundColor: "#f2f8fc",
    // O app web já trata as áreas do entalhe/barra (viewport-fit=cover + env(safe-area-inset-*)).
    contentInset: "never",
    scheme: "Corretor360",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0a86d0",
      showSpinner: false,
    },
    SystemBars: {
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
      // Cabeçalho do app é claro: ícones escuros na barra de status.
      style: "LIGHT",
    },
  },
};

export default config;
