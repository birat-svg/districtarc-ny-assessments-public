// scripts/build-school-names.mjs
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const DATA_ROOT = path.join(process.cwd(), "data", "state_score_public_districtarc");
const SUBJECT_DIRS = [
  path.join(DATA_ROOT, "ELA", "school"),
  path.join(DATA_ROOT, "Math", "school"),
];

const PUBLIC_DIR = path.join(process.cwd(), "public", "ny-assessments-public");
const OUT_NAMES = path.join(PUBLIC_DIR, "school-names.json");

// Column name aliases we accept for "school name"
const NAME_ALIASES = [
  "School Name",
  "School",
  "School_Name",
  "School name",
  "Location Name",
  "Location_Name",
  "Location name",
  "Location",
  "SchoolName",
  "Campus Name",
];

// Helper utils
const norm = (v) => String(v ?? "").trim();
const lower = (v) => norm(v).toLowerCase();
const looksLikeDBN = (s) => /^[0-9]{2}[A-Z][0-9]{3}$/i.test(norm(s)); // e.g. 01M110, 25Q193

function log(...args) {
  console.log("[build-names]", ...args);
}

// Try to find a reasonable header row
function findHeaderRow(ws) {
  const MAX = Math.min(40, ws.actualRowCount || 40);
  for (let r = 1; r <= MAX; r++) {
    const row = ws.getRow(r);
    const texts = (row.values || []).map((v) => lower(v));
    const joined = texts.join(" ");
    if (joined.includes("name") && (joined.includes("school") || joined.includes("location"))) {
      return r;
    }
  }
  // fallback: first row with at least 3 text cells
  for (let r = 1; r <= MAX; r++) {
    const row = ws.getRow(r);
    const texts = (row.values || []).map((v) => norm(v));
    const nonEmpty = texts.filter(Boolean).length;
    if (nonEmpty >= 3) return r;
  }
  return 1;
}

// Find a "school name" column
function findNameColumn(ws, headerRowIndex) {
  const header = ws.getRow(headerRowIndex);
  const cols = header.cellCount;

  const exactMap = {};
  for (let c = 1; c <= cols; c++) {
    const key = norm(header.getCell(c).value);
    if (key) exactMap[lower(key)] = c;
  }

  // Exact alias match
  for (const alias of NAME_ALIASES) {
    const col = exactMap[lower(alias)];
    if (col) return col;
  }

  // Fuzzy: must include "name" and either "school" or "location"
  for (let c = 1; c <= cols; c++) {
    const t = lower(header.getCell(c).value);
    if (!t) continue;
    if (t.includes("name") && (t.includes("school") || t.includes("location"))) {
      return c;
    }
  }

  return -1;
}

async function readNamesFromWorkbook(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const names = new Set();

  for (const ws of wb.worksheets) {
    if (!ws || !ws.actualRowCount) continue;

    const headerRowIndex = findHeaderRow(ws);
    const nameCol = findNameColumn(ws, headerRowIndex);

    if (nameCol !== -1) {
      log(`Sheet "${ws.name}": found name column at C${nameCol} (header row R${headerRowIndex})`);
      for (let r = headerRowIndex + 1; r <= ws.actualRowCount; r++) {
        const val = norm(ws.getRow(r).getCell(nameCol).value);
        if (!val) continue;
        if (/^all\s*students?$/i.test(val)) continue;
        names.add(val);
      }
      continue;
    }

    // --- Fallback heuristic ---
    // If col1 looks like DBN and col2 looks like text, treat col2 as the name.
    const hdr = ws.getRow(headerRowIndex);
    const firstDataRow = headerRowIndex + 1;
    if (firstDataRow <= ws.actualRowCount) {
      const c1 = norm(ws.getRow(firstDataRow).getCell(1).value);
      const c2 = norm(ws.getRow(firstDataRow).getCell(2).value);
      if (looksLikeDBN(c1) && c2) {
        log(`Sheet "${ws.name}": using fallback (C1=DBN, C2=name).`);
        for (let r = firstDataRow; r <= ws.actualRowCount; r++) {
          const name = norm(ws.getRow(r).getCell(2).value);
          if (name) names.add(name);
        }
        continue;
      }
    }

    log(`Sheet "${ws.name}": no obvious name column; skipping.`);
  }

  return Array.from(names);
}

async function main() {
  const all = new Set();

  log("CWD:", process.cwd());
  for (const dir of SUBJECT_DIRS) {
    log("Scanning dir:", dir);
    if (!fs.existsSync(dir)) {
      log("  (missing)");
      continue;
    }
    const files = fs.readdirSync(dir).filter((f) => /\.xlsx?$/i.test(f));
    log("  Files:", files.length);
    for (const f of files) {
      const full = path.join(dir, f);
      try {
        log("  → Reading:", f);
        const found = await readNamesFromWorkbook(full);
        log("    +", found.length, "names");
        found.forEach((n) => all.add(n));
      } catch (e) {
        log("    ! error:", e?.message);
      }
    }
  }

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const sorted = Array.from(all).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  fs.writeFileSync(OUT_NAMES, JSON.stringify({ names: sorted }, null, 2));
  log(`Wrote ${sorted.length} names → ${OUT_NAMES}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
