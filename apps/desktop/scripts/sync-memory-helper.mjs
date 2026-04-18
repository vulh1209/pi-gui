import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptDir, "..");
const resourcesDir = path.join(desktopDir, "resources", "memory-helper");
const sourceEnvVar = "PI_MEMORY_EXTENSION_SOURCE_DIR";

function helperEntryExists(root) {
  return existsSync(path.join(root, "src", "memory", "helper-entry.ts"));
}

function resolveFromEnv() {
  const configured = process.env[sourceEnvVar]?.trim();
  if (!configured) {
    return undefined;
  }
  const resolved = path.resolve(configured);
  return helperEntryExists(resolved) ? resolved : undefined;
}

function resolveFromInstalledPackage() {
  try {
    const packageJsonPath = require.resolve("@lehoangvu/pi-memory-extension/package.json", { paths: [desktopDir] });
    const packageRoot = path.dirname(packageJsonPath);
    return helperEntryExists(packageRoot) ? packageRoot : undefined;
  } catch {
    return undefined;
  }
}

function resolveFromSiblingRepo() {
  const candidate = path.resolve(desktopDir, "..", "..", "..", "pi-memory-extension");
  return helperEntryExists(candidate) ? candidate : undefined;
}

function resolveSourceRoot() {
  return resolveFromEnv() ?? resolveFromInstalledPackage() ?? resolveFromSiblingRepo();
}

function rewriteRelativeTypeScriptSpecifiers(sourceText) {
  return sourceText.replace(/(["'])(\.{1,2}\/[^"']+)\.ts\1/g, "$1$2.js$1");
}

async function listTypeScriptFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function transpileSourceTree(sourceRoot, outputRoot) {
  const sourceDir = path.join(sourceRoot, "src");
  const files = await listTypeScriptFiles(sourceDir);
  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath);
    const outputPath = path.join(outputRoot, relativePath.replace(/\.ts$/, ".js"));
    const sourceText = await readFile(filePath, "utf8");
    const transpiled = ts.transpileModule(sourceText, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
      fileName: filePath,
    });
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rewriteRelativeTypeScriptSpecifiers(transpiled.outputText), "utf8");
  }
}

const sourceRoot = resolveSourceRoot();
if (!sourceRoot) {
  console.warn(
    `[memory-helper] source not found. Set ${sourceEnvVar} or clone pi-memory-extension beside pi-gui to package the helper payload.`,
  );
  process.exit(0);
}

await mkdir(resourcesDir, { recursive: true });
await rm(path.join(resourcesDir, "dist"), { recursive: true, force: true });
await rm(path.join(resourcesDir, "src"), { recursive: true, force: true });
await rm(path.join(resourcesDir, "sql"), { recursive: true, force: true });
await transpileSourceTree(sourceRoot, path.join(resourcesDir, "dist"));
await cp(path.join(sourceRoot, "sql"), path.join(resourcesDir, "sql"), { recursive: true });
await writeFile(
  path.join(resourcesDir, "package.json"),
  `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  "utf8",
);
console.log(`[memory-helper] synced helper payload from ${sourceRoot} into ${resourcesDir}`);
