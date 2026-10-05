/**
 * Script de synchronisation des dépendances exceljs du frontend vers le backend.
 * Exécution : node copy-deps.js
 * Ne copy que les modules absents du backend.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FRONTEND = "c:\\Users\\deffo_a\\ALL_PROJECTS_SOREPCO\\Gestion_Incident_V1-main\\node_modules";
const BACKEND  = "c:\\Users\\deffo_a\\ALL_PROJECTS_SOREPCO\\api_gestion_incident_V1-main\\node_modules";

const toCopy = new Set();

function walkDeps(pkgPath, seen = new Set()) {
  const pkgJson = path.join(pkgPath, "package.json");
  if (!fs.existsSync(pkgJson)) return;
  const { dependencies = {} } = require(pkgJson);
  for (const [dep, version] of Object.entries(dependencies)) {
    if (seen.has(dep)) continue;
    seen.add(dep);
    const src = path.join(FRONTEND, dep);
    if (!fs.existsSync(path.join(BACKEND, dep))) {
      toCopy.add(dep);
    }
    if (fs.existsSync(src)) {
      walkDeps(src, seen);
    }
  }
}

// Partir d'exceljs
walkDeps(path.join(FRONTEND, "exceljs"));

// Copier chaque module manquant
for (const mod of toCopy) {
  const src = path.join(FRONTEND, mod);
  const dst = path.join(BACKEND, mod);
  if (!fs.existsSync(src)) {
    console.warn(`  [SKIP] ${mod} — n'existe pas dans le frontend`);
    continue;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execSync(`xcopy /E /I /Y "${src}" "${dst}"`, { stdio: "pipe" });
  console.log(`  [COPIED] ${mod}`);
}

console.log(`\nDone — ${toCopy.size} module(s) copié(s).`);
