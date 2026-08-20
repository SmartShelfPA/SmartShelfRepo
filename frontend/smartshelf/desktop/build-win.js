/**
 * Package the Windows installer outside OneDrive, using desktop/ as the
 * Electron app (not the Expo package.json). Packing Expo node_modules
 * made the previous build hang; Cursor/OneDrive locking
 * desktop-release\win-unpacked.tmp caused EBUSY.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const frontendRoot = path.resolve(__dirname, "..");
const desktopDir = __dirname;
const distDir = path.join(frontendRoot, "dist");
const localAppData = process.env.LOCALAPPDATA || path.join(frontendRoot, "desktop-release");
const outDir = path.join(localAppData, "SmartShelf", "desktop-release");

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error("Missing web export. Run npm run desktop:export first.");
  process.exit(1);
}

try {
  fs.rmSync(outDir, { recursive: true, force: true });
} catch (err) {
  console.warn("Could not clean previous output:", err.message);
}
fs.mkdirSync(outDir, { recursive: true });

console.log("Packaging Windows installer to:");
console.log("  " + outDir);

const result = spawnSync(
  "npx",
  [
    "electron-builder",
    "--win",
    "--config",
    "electron-builder.yml",
    `-c.directories.output=${outDir}`,
  ],
  { cwd: desktopDir, stdio: "inherit", shell: true }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const exe = path.join(outDir, "SmartShelf-Setup.exe");
if (!fs.existsSync(exe)) {
  console.error("Build finished but SmartShelf-Setup.exe was not found at:");
  console.error("  " + exe);
  process.exit(1);
}

console.log("\nInstaller ready:");
console.log("  " + exe);
