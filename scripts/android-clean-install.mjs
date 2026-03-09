import { spawnSync } from "node:child_process";

const APP_ID = process.env.ANDROID_APP_ID || "com.livrovivo.app";
const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";
const ADB_BIN = process.platform === "win32" ? "adb.exe" : "adb";

function runSync(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    stdio: options.stdio ?? "pipe",
    encoding: "utf8",
    env: process.env,
  });
}

function getConnectedDeviceSerials() {
  const result = runSync(ADB_BIN, ["devices"]);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || "Falha ao executar adb devices.");
  }

  const lines = (result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .slice(1)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[1] === "device")
    .map((parts) => parts[0]);
}

function uninstallPackageFromDevice(serial, appId) {
  const result = runSync(ADB_BIN, ["-s", serial, "uninstall", appId]);
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();

  if (result.status === 0) {
    if (output) {
      console.log(`[android:clean-install] ${serial}: ${output}`);
    }
    return;
  }

  const knownSafeFailures = [
    "Unknown package",
    "not installed",
    "DELETE_FAILED_INTERNAL_ERROR",
  ];
  if (knownSafeFailures.some((token) => output.includes(token))) {
    console.log(`[android:clean-install] ${serial}: pacote ausente, seguindo instalação.`);
    return;
  }

  throw new Error(
    `[android:clean-install] Falha ao desinstalar ${appId} em ${serial}: ${output || "erro desconhecido"}`
  );
}

function runExpoAndroid(extraArgs) {
  const result = spawnSync(NPX_BIN, ["expo", "run:android", "--all-arch", ...extraArgs], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  const deviceSerials = getConnectedDeviceSerials();

  if (deviceSerials.length === 0) {
    console.log("[android:clean-install] Nenhum device conectado. Rodando expo mesmo assim.");
  } else {
    console.log(
      `[android:clean-install] Desinstalando ${APP_ID} em ${deviceSerials.length} device(s) antes do install...`
    );
    for (const serial of deviceSerials) {
      uninstallPackageFromDevice(serial, APP_ID);
    }
  }

  const extraArgs = process.argv.slice(2);
  runExpoAndroid(extraArgs);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
