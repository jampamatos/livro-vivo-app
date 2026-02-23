import fs from "node:fs";
import path from "node:path";

const enforceReleaseChecks =
  process.env.RELEASE_BUILD === "1" ||
  process.env.RELEASE_BUILD === "true";

if (!enforceReleaseChecks) {
  console.log(
    "Skipping release config validation (set RELEASE_BUILD=true to enforce)."
  );
  process.exit(0);
}

const appJsonPath = path.resolve(process.cwd(), "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

const iosBundleIdentifier = appJson?.expo?.ios?.bundleIdentifier ?? "";
const androidPackage = appJson?.expo?.android?.package ?? "";

const errors = [];

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

if (errors.length > 0) {
  console.error("Release config validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Release config validation passed.");
