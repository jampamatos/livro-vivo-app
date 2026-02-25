import fs from "node:fs";
import path from "node:path";

const enforceReleaseChecks =
  process.env.RELEASE_BUILD === "1" ||
  process.env.RELEASE_BUILD === "true";

const appJsonPath = path.resolve(process.cwd(), "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

const appName = appJson?.expo?.name ?? "";
const appSlug = appJson?.expo?.slug ?? "";
const iosBundleIdentifier = appJson?.expo?.ios?.bundleIdentifier ?? "";
const androidPackage = appJson?.expo?.android?.package ?? "";

const errors = [];

if (!appName || appName.trim().length < 3) {
  errors.push("expo.name is missing or too short.");
}

if (!appSlug || appSlug.trim().length < 3) {
  errors.push("expo.slug is missing or too short.");
}

if (!iosBundleIdentifier || iosBundleIdentifier.startsWith("com.anonymous.")) {
  errors.push(
    "ios.bundleIdentifier is missing or still uses placeholder 'com.anonymous.*'."
  );
}

if (!androidPackage || androidPackage.startsWith("com.anonymous.")) {
  errors.push(
    "android.package is missing or still uses placeholder 'com.anonymous.*'."
  );
}

const bundleIdRegex = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;
if (iosBundleIdentifier && !bundleIdRegex.test(iosBundleIdentifier)) {
  errors.push("ios.bundleIdentifier is invalid.");
}
if (androidPackage && !bundleIdRegex.test(androidPackage)) {
  errors.push("android.package is invalid.");
}

if (enforceReleaseChecks) {
  const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();
  if (!apiBaseUrl) {
    errors.push("EXPO_PUBLIC_API_BASE_URL is required for release builds.");
  } else {
    if (!apiBaseUrl.startsWith("https://")) {
      errors.push("EXPO_PUBLIC_API_BASE_URL must use https:// in release builds.");
    }
    if (
      apiBaseUrl.includes("localhost") ||
      apiBaseUrl.includes("127.0.0.1")
    ) {
      errors.push(
        "EXPO_PUBLIC_API_BASE_URL cannot point to localhost in release builds."
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Release config validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Release config validation passed.");
