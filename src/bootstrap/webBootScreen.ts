import { Asset } from "expo-asset";
import { Platform } from "react-native";

const BOOT_SCREEN_ID = "lv-web-boot-screen";

function getBootIconUri() {
  try {
    const asset = Asset.fromModule(require("../../assets/branding/icon-1-ui.png"));
    return asset.localUri || asset.uri || "";
  } catch {
    return "";
  }
}

export function ensureWebBootScreen() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById(BOOT_SCREEN_ID)) return;
  const bootIconUri = getBootIconUri();

  const screen = document.createElement("div");
  screen.id = BOOT_SCREEN_ID;
  screen.setAttribute("aria-hidden", "true");
  screen.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:24px",
    "background:#F7F4EE",
    "transition:opacity 180ms ease",
  ].join(";");

  screen.innerHTML = `
    <div style="width:min(100%,420px);background:#FFFFFF;border:1px solid #D8D1C4;border-radius:24px;padding:28px 24px;box-shadow:0 10px 28px rgba(15,23,42,0.08);display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;">
      <div style="width:72px;height:72px;border-radius:24px;background:#1E3760;border:1px solid #C5BBA9;overflow:hidden;">
        ${bootIconUri ? `<img src="${bootIconUri}" alt="" style="width:100%;height:100%;object-fit:cover;" />` : ""}
      </div>
      <div style="color:#B27F15;font:800 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:.18em;text-transform:uppercase;">Plataforma Livro Vivo</div>
      <div style="color:#15223D;font:800 30px Georgia,serif;">Direito do Passageiro</div>
      <div style="color:#5D6A84;font:400 15px/22px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:320px;">
        Preparando sua biblioteca viva, jurisprudência e ferramentas de prática.
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:999px;border:1px solid #D8D1C4;background:#F2EEE6;color:#15223D;font:700 14px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <span style="width:14px;height:14px;border:2px solid #1E5FA8;border-top-color:transparent;border-radius:999px;display:inline-block;animation:lv-web-boot-spin .8s linear infinite;"></span>
        <span>Carregando ambiente</span>
      </div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = "@keyframes lv-web-boot-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  screen.appendChild(style);
  document.body.appendChild(screen);
}

export function hideWebBootScreen() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const screen = document.getElementById(BOOT_SCREEN_ID);
  if (!screen) return;
  screen.style.opacity = "0";
  window.setTimeout(() => {
    screen.remove();
  }, 220);
}
