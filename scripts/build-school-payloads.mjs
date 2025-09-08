// scripts/build-school-payloads.mjs
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const DATA_ROOT = path.join(process.cwd(), "data", "state_score_public_districtarc");
const SUBJECTS = ["ELA", "Math"];
const SHEET_SUFFIXES = ["All", "SWD", "Ethnicity", "Gender", "Econ Status", "ELL"];
const PUBLIC_DIR = path.join(process.cwd(), "public", "ny-assessments-public", "schools");

const COLS = {
  year: "Year",
  grade: "Grade",
  cat: "Category",
  n: "Number Tested",
  mean: "Mean Scale Score",
  p1: "% Level 1",
  p2: "% Level 2",
  p3: "% Level 3",
  p4: "% Level 4",
  p34: "% Level 3+4",
};

const POSSIBLE_SCHOOL_KEYS = ["School Name", "School", "SchoolName"];

function isXlsx(f) {
  return /\.(xlsx|xls)$/i.test(f);
}
function sheetHeaders(ws) {
  const row = ws.getRow(1);
  return (row.values ?? []).slice(1).map(v => String(v ?? "").trim());
}
function labelFromSheetName(name, subject) {
  const hit = SHEET_SUFFIXES.find(s => name.toLowerCase().includes(s.toLowerCase()));
  return hit ? `${subject} - ${hit}` : null;
}
function asNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[% ,]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function normalizeRow(raw) {
  const obj = {};
  // copy canonical
  Object.values(COLS).forEach(k => (obj[k] = raw[k] ?? null));
  // keep ID-ish fields if present
  ["Borough", "District", "School Name", "School", "SchoolName"].forEach(k => {
    if (k in raw) obj[k] = raw[k];
  });
  if (obj[COLS.year] != null) obj[COLS.year] = asNumber(obj[COLS.year]);
  [COLS.n, COLS.mean, COLS.p1, COLS.p2, COLS.p3, COLS.p4, COLS.p34].forEach(k => {
    obj[k] = obj[k] != null ? asNumber(obj[k]) : null;
  });
  ["Grade", "Category", "Borough", "District", "School Name", "School", "SchoolName"].forEach(k => {
    if (k in obj && obj[k] != null) obj[k] = String(obj[k]).trim();
  });
  return obj;
}

function safeSlug(name) {
  // Keep readable filenames
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function buildSubject(subject) {
  const baseDir = path.join(DATA_ROOT, subject, "school");
  if (!fs.existsSync(baseDir)) {
    console.log(`[build-schools] skip ${subject} (no dir)`);
    return;
  }

  // Map: schoolName -> { "ELA - All": [], ... }
  const bySchool = new Map();

  const files = fs.readdirSync(baseDir).filter(isXlsx);
  for (const file of files) {
    const fp = path.join(baseDir, file);
    console.log(`[build-schools] reading ${subject} file: ${file}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fp);

    for (const ws of wb.worksheets) {
      const label = labelFromSheetName(ws.name, subject);
      if (!label) continue;

      const headers = sheetHeaders(ws);
      const nameKey = POSSIBLE_SCHOOL_KEYS.find(k => headers.includes(k));
      if (!nameKey) continue;

      const rowCount = ws.actualRowCount || ws.rowCount;
      for (let r = 2; r <= rowCount; r++) {
        const row = ws.getRow(r);
        const vals = (row.values ?? []).slice(1);
        if (!vals.length) continue;

        const raw = {};
        headers.forEach((h, i) => (raw[h] = vals[i] ?? null));

        const name = String(raw[nameKey] ?? "").trim();
        if (!name) continue;

        const norm = normalizeRow(raw);
        if (!bySchool.has(name)) bySchool.set(name, {});
        const bucket = bySchool.get(name);
        if (!bucket[label]) bucket[label] = [];
        bucket[label].push(norm);
      }
    }
  }

  // Sort each sheet in each school and write files
  const outDir = path.join(PUBLIC_DIR, subject);
  fs.mkdirSync(outDir, { recursive: true });

  let i = 0;
  for (const [name, sheets] of bySchool.entries()) {
    Object.keys(sheets).forEach(k => {
      sheets[k].sort((a, b) => {
        const ya = Number(a[COLS.year] ?? 0);
        const yb = Number(b[COLS.year] ?? 0);
        if (ya !== yb) return ya - yb;
        const ga = String(a["Grade"] ?? "");
        const gb = String(b["Grade"] ?? "");
        return ga.localeCompare(gb, undefined, { numeric: true, sensitivity: "base" });
      });
    });
    const slug = safeSlug(name);
    const dest = path.join(outDir, `${slug}.json`);
    fs.writeFileSync(dest, JSON.stringify(sheets));
    i++;
    if (i % 100 === 0) console.log(`[build-schools] wrote ${i} ${subject} schools...`);
  }
  console.log(`[build-schools] DONE ${subject}: wrote ${bySchool.size} school files → ${outDir}`);
}

async function main() {
  console.log(`[build-schools] CWD: ${process.cwd()}`);
  for (const s of SUBJECTS) {
    await buildSubject(s);
  }
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
