// lib/loadAssessments.ts
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";

/* ============================================================
   Types & constants (kept simple; UI can keep using "ELA" | "Math")
   ============================================================ */
export type Level = "city" | "borough" | "district" | "school";
export type Subject = "ELA" | "Math";

const LEVELS: Level[] = ["city", "borough", "district", "school"];
const SUBJECTS: Subject[] = ["ELA", "Math"];

// Names we look for in sheet tabs to build labels like "ELA - SWD"
const SHEET_SUFFIXES = ["All", "SWD", "Ethnicity", "Gender", "Econ Status", "ELL"] as const;

export const DATA_ROOT = path.join(process.cwd(), "data", "state_score_public_districtarc");

// Canonical columns used by the UI
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
} as const;

// Keep these ID columns if present in the sheet (for filters)
const EXTRA_KEYS = ["Borough", "District", "School Name", "School", "SchoolName"] as const;

// Some XLSX use different school name headers
const POSSIBLE_SCHOOL_KEYS = ["School Name", "School", "SchoolName"] as const;

/* ============================================================
   Normalization helpers
   ============================================================ */

// Option 2: normalize any inbound subject string to BOTH the pretty label and on-disk folder.
// Returns strictly "ELA" or "Math" (matching SUBJECTS and your actual folder names).
function normalizeSubject(subjectIn: string): Subject {
  const s = String(subjectIn || "").trim().toLowerCase();
  if (s === "ela") return "ELA";
  if (s === "math" || s === "mathematics" || s === "m") return "Math";
  // If user sends "MATH", "Math", "math", they all normalize to "Math"
  throw new Error(`Invalid subject "${subjectIn}". Expected: ELA, Math`);
}

const isXlsx = (f: string) => /\.(xlsx|xls)$/i.test(f);

const asNumber = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[% ,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const dirMtimeMs = (p: string) => {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
};

const labelFromSheetName = (name: string, normalizedSubject: Subject) => {
  const hit = SHEET_SUFFIXES.find((s) =>
    name.toLowerCase().includes(s.toLowerCase())
  );
  return hit ? `${normalizedSubject} - ${hit}` : null;
};

/* ============================================================
   XLSX → JSON (row normalization)
   ============================================================ */

function sheetHeaders(ws: ExcelJS.Worksheet): string[] {
  const headerRow = ws.getRow(1);
  return (headerRow.values as any[]).slice(1).map((c) => String(c ?? "").trim());
}

function sheetToJson(ws: ExcelJS.Worksheet) {
  const out: any[] = [];
  const rowCount = ws.actualRowCount || ws.rowCount;
  if (!rowCount) return out;

  const headers = sheetHeaders(ws);

  for (let r = 2; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const cells = (row.values as any[]).slice(1);
    if (cells.every((c) => c == null || String(c).trim() === "")) continue;

    const raw: Record<string, any> = {};
    for (let i = 0; i < headers.length; i++) raw[headers[i]] = cells[i] ?? null;

    // Normalize into canonical shape
    const obj: Record<string, any> = {};
    // copy canonical
    Object.values(COLS).forEach((k) => (obj[k] = raw[k] ?? null));
    // keep ID/extra columns if present
    EXTRA_KEYS.forEach((k) => {
      if (k in raw) obj[k] = raw[k];
    });

    // numeric conversions
    if (obj[COLS.year] != null) obj[COLS.year] = asNumber(obj[COLS.year]);
    [COLS.n, COLS.mean, COLS.p1, COLS.p2, COLS.p3, COLS.p4, COLS.p34].forEach((k) => {
      obj[k] = obj[k] != null ? asNumber(obj[k]) : null;
    });

    // string trims
    [COLS.grade, COLS.cat, ...EXTRA_KEYS].forEach((k) => {
      if (k in obj && obj[k] != null) obj[k] = String(obj[k]).trim();
    });

    if (obj[COLS.year] != null) out.push(obj);
  }

  return out;
}

/* ============================================================
   Caches (avoid re-reading 40MB XLSX repeatedly)
   ============================================================ */

type Payload = Record<string, any[]>;
type CacheEntry<T> = { mtimeMs: number; value: T };

const datasetCache = new Map<string, CacheEntry<Payload>>();
const namesCache = new Map<string, CacheEntry<string[]>>();
const pendingPayload = new Map<string, Promise<Payload>>();
const pendingNames = new Map<string, Promise<string[]>>();

/* ============================================================
   Public API (used by /api/assessments)
   ============================================================ */

// 1) Load full dataset (city/borough/district). For school, use loadSchoolForName.
export async function loadAssessments(subjectIn: string, levelIn: string): Promise<Payload> {
  const subject = normalizeSubject(subjectIn); // → "ELA" or "Math"
  const level = String(levelIn || "").toLowerCase() as Level;

  if (!LEVELS.includes(level)) throw new Error(`Invalid level "${level}". Expected: ${LEVELS.join(", ")}`);
  if (!SUBJECTS.includes(subject)) throw new Error(`Invalid subject "${subject}". Expected: ${SUBJECTS.join(", ")}`);

  const baseDir = path.join(DATA_ROOT, subject, level);
  if (!fs.existsSync(baseDir)) return {};
  if (level === "school") throw new Error("Use loadSchoolForName for level=school");

  const key = `${subject}:${level}`;
  const mtimeMs = dirMtimeMs(baseDir);

  const hit = datasetCache.get(key);
  if (hit && hit.mtimeMs === mtimeMs) return hit.value;

  const inflight = pendingPayload.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<Payload> => {
    const bySheet: Payload = {};
    const files = fs.readdirSync(baseDir).filter(isXlsx);

    for (const file of files) {
      const fp = path.join(baseDir, file);
      const wb = new ExcelJS.Workbook();
      try {
        await wb.xlsx.readFile(fp);
      } catch {
        continue;
      }

      for (const ws of wb.worksheets) {
        const label = labelFromSheetName(ws.name, subject);
        if (!label) continue;

        let rows: any[] = [];
        try {
          rows = sheetToJson(ws);
        } catch {
          continue;
        }
        if (!rows.length) continue;

        if (!bySheet[label]) bySheet[label] = [];
        bySheet[label].push(...rows);
      }
    }

    // stable sort within each sheet
    Object.keys(bySheet).forEach((k) => {
      bySheet[k].sort((a, b) => {
        const ya = Number(a[COLS.year] ?? 0);
        const yb = Number(b[COLS.year] ?? 0);
        if (ya !== yb) return ya - yb;
        const ga = String(a[COLS.grade] ?? "");
        const gb = String(b[COLS.grade] ?? "");
        return ga.localeCompare(gb, undefined, { numeric: true, sensitivity: "base" });
      });
    });

    datasetCache.set(key, { mtimeMs, value: bySheet });
    return bySheet;
  })().finally(() => pendingPayload.delete(key));

  pendingPayload.set(key, promise);
  return promise;
}

// 2) Unique list of school names for the normalized subject (fast names-only pass)
export async function getSchoolNames(subjectIn: string): Promise<string[]> {
  const subject = normalizeSubject(subjectIn); // → "ELA" or "Math"
  const baseDir = path.join(DATA_ROOT, subject, "school");
  if (!fs.existsSync(baseDir)) return [];

  const key = `${subject}:school:names`;
  const mtimeMs = dirMtimeMs(baseDir);

  const hit = namesCache.get(key);
  if (hit && hit.mtimeMs === mtimeMs) return hit.value;

  const inflight = pendingNames.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<string[]> => {
    const names = new Set<string>();
    const files = fs.readdirSync(baseDir).filter(isXlsx);

    for (const file of files) {
      const fp = path.join(baseDir, file);
      const wb = new ExcelJS.Workbook();
      try {
        await wb.xlsx.readFile(fp);
      } catch {
        continue;
      }

      for (const ws of wb.worksheets) {
        const headers = sheetHeaders(ws);
        const nameKey = POSSIBLE_SCHOOL_KEYS.find((k) => headers.includes(k));
        if (!nameKey) continue;

        const rowCount = ws.actualRowCount || ws.rowCount;
        for (let r = 2; r <= rowCount; r++) {
          const row = ws.getRow(r);
          const cells = (row.values as any[]).slice(1);
          if (!cells.length) continue;
          const idx = headers.indexOf(nameKey);
          const raw = cells[idx];
          if (raw == null) continue;
          const name = String(raw).trim();
          if (name) names.add(name);
        }
      }
    }

    const list = Array.from(names.values()).sort((a, b) => a.localeCompare(b));
    namesCache.set(key, { mtimeMs, value: list });
    return list;
  })().finally(() => pendingNames.delete(key));

  pendingNames.set(key, promise);
  return promise;
}

// 3) Load rows only for a single school (small payload for the UI)
export async function loadSchoolForName(subjectIn: string, schoolName: string): Promise<Payload> {
  const subject = normalizeSubject(subjectIn); // → "ELA" or "Math"
  const baseDir = path.join(DATA_ROOT, subject, "school");
  if (!fs.existsSync(baseDir)) return {};

  const bySheet: Payload = {};
  const files = fs.readdirSync(baseDir).filter(isXlsx);

  for (const file of files) {
    const fp = path.join(baseDir, file);
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(fp);
    } catch {
      continue;
    }

    for (const ws of wb.worksheets) {
      const label = labelFromSheetName(ws.name, subject);
      if (!label) continue;

      const headers = sheetHeaders(ws);
      const nameKey = POSSIBLE_SCHOOL_KEYS.find((k) => headers.includes(k));
      if (!nameKey) continue;

      const rowsAll = sheetToJson(ws);
      const rows = rowsAll.filter(
        (r) => String(r[nameKey] || "").trim() === String(schoolName || "").trim()
      );
      if (!rows.length) continue;

      if (!bySheet[label]) bySheet[label] = [];
      bySheet[label].push(...rows);
    }
  }

  Object.keys(bySheet).forEach((k) => {
    bySheet[k].sort((a, b) => {
      const ya = Number(a[COLS.year] ?? 0);
      const yb = Number(b[COLS.year] ?? 0);
      if (ya !== yb) return ya - yb;
      const ga = String(a[COLS.grade] ?? "");
      const gb = String(b[COLS.grade] ?? "");
      return ga.localeCompare(gb, undefined, { numeric: true, sensitivity: "base" });
    });
  });

  return bySheet;
}
