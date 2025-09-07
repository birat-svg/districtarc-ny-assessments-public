// scripts/build-school-names.mjs
import fs from "node:fs/promises";
import path from "node:path";
import xlsx from "xlsx";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "state_score_public_districtarc");
const OUT_DIR = path.join(ROOT, "public", "ny-assessments-public");
const OUT_FILE = path.join(OUT_DIR, "school-names.json");

// Helper: recursively find all .xlsx files that live in a /school/ folder
async function findSchoolWorkbooks(dir) {
  const out = [];
  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (
        e.isFile() &&
        e.name.endsWith(".xlsx") &&
        !e.name.startsWith("~$") && // ignore lock files
        p.split(path.sep).includes("school")
      ) {
        out.push(p);
      }
    }
  }
  await walk(dir);
  return out;
}

// Heuristic to pick the "School Name" header.
// Fall back to any header that contains both "school" and "name" (case-insensitive).
function resolveSchoolNameKey(headers) {
  const CANDIDATES = [
    "School Name",
    "School",
    "SCHOOL NAME",
    "School_Name",
    "SchoolName",
  ];
  for (const c of CANDIDATES) if (headers.includes(c)) return c;
  const lower = headers.map((h) => h.toLowerCase());
  const idx = lower.findIndex((h) => h.includes("school") && h.includes("name"));
  return idx >= 0 ? headers[idx] : null;
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean).map((s) => String(s).trim()))).sort((a, b) =>
    a.localeCompare(b)
  );
}

async function build() {
  console.log("→ Building school-names.json from XLSX…");
  const files = await findSchoolWorkbooks(DATA_DIR);
  if (!files.length) {
    console.log("No school-level workbooks found under:", DATA_DIR);
    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.writeFile(OUT_FILE, "[]");
    console.log("Wrote empty list:", OUT_FILE);
    return;
  }

  const names = new Set();

  for (const file of files) {
    console.log("  reading:", path.relative(ROOT, file));
    const wb = xlsx.readFile(file, {
      cellDates: false,
      cellFormula: false,
      sheetStubs: false,
    });

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
      if (!rows.length) continue;

      const headers = Object.keys(rows[0] || {});
      const key = resolveSchoolNameKey(headers);
      if (!key) continue;

      for (const r of rows) {
        const v = r[key];
        if (!v) continue;
        // Skip aggregate-like rows if any show up
        const s = String(v).trim();
        if (!s || /^all( students)?$/i.test(s)) continue;
        names.add(s);
      }
    }
  }

  const finalList = uniqueSorted(Array.from(names));
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(finalList, null, 2));
  console.log(`✓ Wrote ${finalList.length} names →`, path.relative(ROOT, OUT_FILE));
}

build().catch((e) => {
  console.error("Build school names failed:", e);
  process.exit(1);
});
