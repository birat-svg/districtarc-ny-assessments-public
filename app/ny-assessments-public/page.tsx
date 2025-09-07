"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { Download, RefreshCcw, X, ChevronDown } from "lucide-react";
import { COLS, POSSIBLE_SCHOOL_KEYS } from "@/lib/cols";

/* ==================== brand (UI shell only) ==================== */
const BRAND = {
  primaryDark: "#0b3b4b",
  primary: "#0e7490",
  primaryLight: "#8fe7ff",
  secondary: "#31504f",
  accent: "#647c7c",
  text: "#0f172a",
  textLight: "#475569",
};

/* ==================== chart color tokens (unchanged) ==================== */
const COLORS = ["#0cbfde", "#565A5C", "#CFB87C", "#3f779c", "#ffd166", "#118ab2", "#06d6a0"] as const;
const LEVEL_COLORS = {
  L1: "#ef4444", // red
  L2: "#f59e0b", // orange
  L3: "#86efac", // light green
  L4: "#16a34a", // green
};

/* ==================== tiny UI helpers ==================== */
const Card = ({ title, subtitle, children }: any) => (
  <div
    className="rounded-2xl border p-5 bg-white"
    style={{ borderColor: "#e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
  >
    {title && (
      <div className="mb-2">
        {subtitle && (
          <div className="text-[11px] tracking-wide uppercase"
               style={{ color: BRAND.textLight }}>
            {subtitle}
          </div>
        )}
        <h3 className="font-semibold" style={{ color: BRAND.text }}>{title}</h3>
      </div>
    )}
    {children}
  </div>
);

const Select = ({ label, value, options, onChange }: any) => (
  <label className="flex flex-col gap-1 text-sm">
    <span style={{ color: BRAND.textLight }}>{label}</span>
    <select
      className="h-10 px-3 rounded-xl border bg-white"
      style={{
        borderColor: "#cbd5e1",
        color: BRAND.text,
        outline: "none",
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o: any) => (
        <option key={String(o)} value={String(o)}>{String(o)}</option>
      ))}
    </select>
  </label>
);

/* ===== searchable combobox for School list ===== */
function SearchableCombo({
  label, value, options, top5, placeholder = "Search school…", onChange,
}: {
  label: string; value: string; options: string[]; top5: string[];
  placeholder?: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const normalized = useMemo(() => {
    const src = q.trim()
      ? options.filter(s => s.toLowerCase().includes(q.trim().toLowerCase()))
      : (top5.length ? top5 : options.slice(0, 12));
    const filtered = src.filter(s => s !== "All");
    return ["All", ...filtered];
  }, [options, q, top5]);

  return (
    <div className="flex flex-col gap-1 text-sm" ref={boxRef}>
      <span style={{ color: BRAND.textLight }}>{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full h-10 px-3 rounded-xl border bg-white flex items-center justify-between"
          style={{ borderColor: "#cbd5e1", color: BRAND.text }}
        >
          <span className="truncate">{value || "All"}</span>
          <ChevronDown size={16} style={{ color: BRAND.accent }} />
        </button>

        {open && (
          <div className="absolute z-30 mt-2 w-[22rem] max-w-[90vw] bg-white border rounded-xl shadow-lg"
               style={{ borderColor: "#e2e8f0" }}>
            <div className="p-2 border-b flex items-center gap-2" style={{ borderColor: "#e2e8f0" }}>
              <input
                autoFocus
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder={placeholder}
                className="w-full h-9 px-3 rounded-lg border"
                style={{ borderColor: "#cbd5e1", outline: "none" }}
              />
              {!!q && (
                <button onClick={()=>setQ("")} className="p-1 rounded-md hover:bg-slate-100">
                  <X size={14} style={{ color: BRAND.accent }} />
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-auto py-1">
              {normalized.length === 0 && (
                <div className="px-3 py-2 text-sm" style={{ color: BRAND.textLight }}>
                  No matches.
                </div>
              )}
              {normalized.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                  style={{
                    color: opt === value ? BRAND.primaryDark : BRAND.text,
                    background: opt === value ? "#f0f9ff" : "white",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== data helpers ==================== */
const uniq = (a: any[]) => Array.from(new Set(a.filter(Boolean)));
const round = (n: any, d = 1) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null);
const sum = (arr: any[], key: string) => arr.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
const weighted = (arr: any[], pctKey: string, weightKey = COLS.n) => {
  const w = arr.reduce((a, r) => a + (Number(r[weightKey]) || 0), 0);
  if (!w) return null;
  const num = arr.reduce((a, r) => a + (Number(r[pctKey]) || 0) * (Number(r[weightKey]) || 0), 0);
  return num / w;
};

type Level = "city" | "borough" | "district" | "school";
type Subject = "ELA" | "Math";

/* ==================== API base (under /ny-assessments-public) ==================== */
const API_BASE = "/ny-assessments-public/api/assessments";

/* ==================== page ==================== */
export default function Page() {
  const [subject, setSubject] = useState<Subject>("ELA");
  const [level, setLevel] = useState<Level>("city");

  const [dataset, setDataset] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // school names + selection
  const [schoolNames, setSchoolNames] = useState<string[]>([]);
  const [school, setSchool] = useState<string>("All");

  // safer fetch per level
  useEffect(() => {
    let ignore = false;
    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      setError(undefined);
      try {
        if (level === "school") {
          const resNames = await fetch(`${API_BASE}?subject=${subject}&level=school&names=1`, { cache: "no-store", signal: ctrl.signal });
          const jn = await resNames.json();
          if (!ignore) setSchoolNames(Array.isArray(jn?.names) ? jn.names : []);

          if (school && school !== "All") {
            const res = await fetch(`${API_BASE}?subject=${subject}&level=school&school=${encodeURIComponent(school)}`, { cache: "no-store", signal: ctrl.signal });
            const json = await res.json();
            if (!ignore) {
              if (!res.ok || json?.error) {
                setError(json?.error || `Server error (${res.status})`);
                setDataset({});
              } else {
                setDataset(json && typeof json === "object" ? json : {});
              }
            }
          } else {
            if (!ignore) setDataset({});
          }
        } else {
          const res = await fetch(`${API_BASE}?subject=${subject}&level=${level}`, { cache: "no-store", signal: ctrl.signal });
          const json = await res.json();
          if (!ignore) {
            if (!res.ok || json?.error) {
              setError(json?.error || `Server error (${res.status})`);
              setDataset({});
            } else {
              const isValid = json && typeof json === "object" && Object.values(json).every((v: any) => Array.isArray(v));
              setDataset(isValid ? json : {});
              if (!isValid) setError("Unexpected data format from server.");
            }
          }
        }
      } catch (e: any) {
        if (!ignore && e?.name !== "AbortError") {
          setError(e?.message || "Request failed.");
          setDataset({});
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => { ignore = true; ctrl.abort(); };
  }, [subject, level, school]);

  /* ---------- sheet & basic filters ---------- */
  const sheetKeys = useMemo(() => Object.keys(dataset || {}), [dataset]);
  const [sheetKey, setSheetKey] = useState<string>("");
  useEffect(() => { setSheetKey(sheetKeys[0] || ""); }, [sheetKeys.join("|")]);

  const sheetRows = (Array.isArray((dataset as any)?.[sheetKey]) ? (dataset as any)[sheetKey] : []) as any[];

  // All rows (for borough/district pickers)
  const allRowsAllSheets = useMemo(
    () => (dataset ? (Object.values(dataset) as any[]).flat() : []) as any[],
    [dataset]
  );

  const years = useMemo(() => uniq(sheetRows.map((r) => r[COLS.year])).map(Number).sort((a,b)=>a-b), [sheetRows]);
  const latestYear = years[years.length - 1];
  const defaultYear = years.includes(2025) ? 2025 : latestYear;
  const [year, setYear] = useState<any>(defaultYear);
  useEffect(() => { setYear(defaultYear); }, [sheetKey]); // only when table changes

  const [grade, setGrade] = useState<any>("All Grades");

  // ===== Category list with CITY+ETHNICITY filter =====
  const rawCategories = useMemo(() => uniq(sheetRows.map((r) => r[COLS.cat])), [sheetRows]);

  const categories = useMemo(() => {
    let cats = rawCategories.slice();
    if (level === "city" && /Ethnicity/i.test(String(sheetKey))) {
      const allow = new Set([
        "All Students",
        "Asian",
        "Black",
        "Hispanic",
        "Native American",
        "White",
        "Multi-Racial",
      ]);
      cats = cats.filter((c) => allow.has(String(c)));
      const order = ["All Students","Asian","Black","Hispanic","Native American","White","Multi-Racial"];
      cats.sort((a,b)=> order.indexOf(String(a)) - order.indexOf(String(b)));
    }
    return cats;
  }, [rawCategories, level, sheetKey]);

  const [category, setCategory] = useState<any>(categories[0] || "All Students");
  useEffect(() => { if (!categories.includes(category)) setCategory(categories[0] || "All Students"); }, [categories]);

  /* ---------- extra filter (borough/district/school) ---------- */
  const extraFilterKey = useMemo(() => {
    if (level === "borough") return "Borough";
    if (level === "district") return "District";
    if (level === "school") {
      const keysInData = new Set<string>(sheetRows.flatMap(r => Object.keys(r)));
      return POSSIBLE_SCHOOL_KEYS.find(k => keysInData.has(k)) || "School Name";
    }
    return null;
  }, [level, sheetRows]);

  const [extraFilter, setExtraFilter] = useState<string>("All");

  const extraOptionsAll = useMemo(() => {
    if (!extraFilterKey) return [];
    if (level === "school") return schoolNames;
    const values = allRowsAllSheets.map((r: any) => r?.[extraFilterKey]).filter(Boolean);
    return uniq(values).sort((a: any, b: any) => String(a).localeCompare(String(b)));
  }, [level, extraFilterKey, allRowsAllSheets, schoolNames]);

  // Reset only when level changes (don’t clear on category/year changes)
  useEffect(() => {
    if (level === "school") {
      setSchool("All");
      setExtraFilter("All");
    } else {
      setExtraFilter("All");
    }
  }, [level]);

  // Validate selection if it disappears because table changed
  useEffect(() => {
    if (!extraFilterKey) return;
    const list = level === "school" ? schoolNames : extraOptionsAll;
    if (extraFilter !== "All" && !list.includes(extraFilter)) {
      setExtraFilter("All");
    }
  }, [extraFilterKey, level, extraOptionsAll.join("|"), schoolNames.join("|")]);

  const passesExtra = (r: any) =>
    !extraFilterKey || extraFilter === "All" || String(r[extraFilterKey]) === String(extraFilter);

  /* ---------- grade options (depends on year) ---------- */
  const grades = useMemo(
    () => uniq(sheetRows.filter((r) => r[COLS.year] === year).map((r) => r[COLS.grade])),
    [sheetRows, year]
  );
  useEffect(() => { if (!grades.includes(grade)) setGrade(grades[0] || "All Grades"); }, [grades]);

  /* ---------- grade matching rule ---------- */
  const matchesGrade = (r: any) => {
    const g = String(r[COLS.grade]);
    return grade === "All Grades" ? g === "All Grades" : g === String(grade);
  };

  /* ---------- derived ---------- */
  const filtered = useMemo(
    () => sheetRows.filter(
      (r) =>
        passesExtra(r) &&
        (year ? Number(r[COLS.year]) === Number(year) : true) &&
        (category ? String(r[COLS.cat]) === String(category) : true) &&
        matchesGrade(r)
    ),
    [sheetRows, year, category, extraFilter, extraFilterKey, grade]
  );

  // KPIs (latest selected year)
  const tested = useMemo(() => {
    const rows = sheetRows.filter(
      (r) =>
        passesExtra(r) &&
        Number(r[COLS.year]) === Number(year) &&
        String(r[COLS.cat]) === String(category) &&
        matchesGrade(r)
    );
    return sum(rows, COLS.n);
  }, [sheetRows, year, category, extraFilter, extraFilterKey, grade]);

  const pct34 = useMemo(() => {
    const rows = sheetRows.filter(
      (r) =>
        passesExtra(r) &&
        Number(r[COLS.year]) === Number(year) &&
        String(r[COLS.cat]) === String(category) &&
        matchesGrade(r)
    );
    return weighted(rows, COLS.p34);
  }, [sheetRows, year, category, extraFilter, extraFilterKey, grade]);

  const avgScaled = useMemo(() => {
    const rows = sheetRows.filter(
      (r) =>
        passesExtra(r) &&
        Number(r[COLS.year]) === Number(year) &&
        String(r[COLS.cat]) === String(category) &&
        matchesGrade(r)
    );
    return weighted(rows, COLS.mean);
  }, [sheetRows, year, category, extraFilter, extraFilterKey, grade]);

  /* ---------- visuals ---------- */

  // Trend by Year
  const trend = useMemo(() => {
    const ys = uniq(sheetRows.map((r) => r[COLS.year])).map(Number).sort((a, b) => a - b);
    return ys.map((y) => {
      const rowsY = sheetRows.filter(
        (r) =>
          passesExtra(r) &&
          Number(r[COLS.year]) === y &&
          String(r[COLS.cat]) === String(category) &&
          matchesGrade(r)
      );
      return { year: y, pct: weighted(rowsY, COLS.p34), mean: weighted(rowsY, COLS.mean) };
    });
  }, [sheetRows, category, grade, extraFilter, extraFilterKey]);

  // Proficiency by Grade (latest year)
  const byGrade = useMemo(() => {
    const rowsYG = sheetRows.filter(
      (r) =>
        passesExtra(r) &&
        Number(r[COLS.year]) === Number(year) &&
        String(r[COLS.cat]) === String(category) &&
        String(r[COLS.grade]) !== "All Grades"
    );
    const gs = uniq(rowsYG.map((r) => r[COLS.grade]));
    return gs.map((g) => {
      const rowsG = rowsYG.filter((r) => String(r[COLS.grade]) === String(g));
      return { grade: g, pct: weighted(rowsG, COLS.p34) };
    });
  }, [sheetRows, year, category, extraFilter, extraFilterKey]);

  // Levels (Latest Year) — pie
  const levelsPie = useMemo(() => {
    const rowsY = sheetRows.filter(
      (r) =>
        passesExtra(r) &&
        Number(r[COLS.year]) === Number(year) &&
        String(r[COLS.cat]) === String(category) &&
        String(r[COLS.grade]) === "All Grades"
    );
    return [
      { name: "Level 1", value: weighted(rowsY, COLS.p1) || 0, color: LEVEL_COLORS.L1 },
      { name: "Level 2", value: weighted(rowsY, COLS.p2) || 0, color: LEVEL_COLORS.L2 },
      { name: "Level 3", value: weighted(rowsY, COLS.p3) || 0, color: LEVEL_COLORS.L3 },
      { name: "Level 4", value: weighted(rowsY, COLS.p4) || 0, color: LEVEL_COLORS.L4 },
    ];
  }, [sheetRows, year, category, extraFilter, extraFilterKey]);

  // Levels stacked by year
  const levelsStacked = useMemo(() => {
    const ys = uniq(sheetRows.map((r) => r[COLS.year])).map(Number).sort((a,b)=>a-b);
    return ys.map((y) => {
      const rowsY = sheetRows.filter(
        (r) =>
          passesExtra(r) &&
          Number(r[COLS.year]) === y &&
          String(r[COLS.cat]) === String(category) &&
          matchesGrade(r)
      );
      return {
        year: y,
        L1: weighted(rowsY, COLS.p1) || 0,
        L2: weighted(rowsY, COLS.p2) || 0,
        L3: weighted(rowsY, COLS.p3) || 0,
        L4: weighted(rowsY, COLS.p4) || 0,
      };
    });
  }, [sheetRows, category, grade, extraFilter, extraFilterKey]);

  // Caterpillar (rank) for Borough/District
  const caterpillar = useMemo(() => {
    if (level !== "borough" && level !== "district") return [];
    const key = level === "borough" ? "Borough" : "District";
    const rows = sheetRows.filter(
      (r) =>
        Number(r[COLS.year]) === Number(year) &&
        String(r[COLS.cat]) === String(category) &&
        matchesGrade(r)
    );
    const groups = uniq(rows.map((r) => r[key]).filter(Boolean));
    const out = groups.map((g) => {
      const rowsG = rows.filter((r) => String(r[key]) === String(g));
      return { name: String(g), pct: weighted(rowsG, COLS.p34) || 0, n: sum(rowsG, COLS.n) };
    }).sort((a,b)=> (a.pct ?? 0) - (b.pct ?? 0));
    return out;
  }, [sheetRows, level, year, category, grade]);

  // Pareto of subgroups w/ benchmark (All Students)
  const pareto = useMemo(() => {
    const rowsY = sheetRows.filter(
      (r) => Number(r[COLS.year]) === Number(year) && matchesGrade(r)
    );
    const cats = uniq(rowsY.map((r) => r[COLS.cat]));
    const data = cats.map((c) => {
      const rowsC = rowsY.filter((r) => String(r[COLS.cat]) === String(c));
      return { cat: String(c), pct: weighted(rowsC, COLS.p34) || 0 };
    }).sort((a,b)=> (b.pct ?? 0) - (a.pct ?? 0));

    const benchRows = rowsY.filter((r) => String(r[COLS.cat]) === "All Students");
    const benchmark = weighted(benchRows, COLS.p34) || null;

    return { data, benchmark };
  }, [sheetRows, year, grade]);

  // Heatmap (Years × Grades) for % L3/4
  const heatmap = useMemo(() => {
    const ys = uniq(sheetRows.map((r) => r[COLS.year])).map(Number).sort((a,b)=>a-b);
    const gs = uniq(sheetRows.map((r) => r[COLS.grade]))
      .filter((g)=>String(g)!=="All Grades")
      .sort((a:any,b:any)=> String(a).localeCompare(String(b), undefined, { numeric: true }));
    const cell = (y:number, g:any) => {
      const rows = sheetRows.filter(
        (r) => passesExtra(r) && Number(r[COLS.year]) === y && String(r[COLS.grade]) === String(g) && String(r[COLS.cat]) === String(category)
      );
      const v = weighted(rows, COLS.p34);
      return v == null ? null : Number(v);
    };
    return { years: ys, grades: gs, val: cell };
  }, [sheetRows, category, extraFilter, extraFilterKey]);

  const schoolKeyInData = useMemo(() => {
    const keys = new Set<string>(sheetRows.flatMap(r => Object.keys(r)));
    return POSSIBLE_SCHOOL_KEYS.find(k => keys.has(k)) || null;
  }, [sheetRows]);

  /* ---------- CSV ---------- */
  function downloadCSV() {
    const rows = filtered;
    if (!rows?.length) return;
    const headers = Object.values(COLS);
    const escape = (s: any) => {
      if (s == null) return "";
      const str = String(s);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csv = [headers.join(",")].concat(rows.map((r: any) => headers.map((h) => escape(r[h])).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const niceSheet = (sheetKey || "Sheet").replace(/\s+/g, "_");
    const extra = extraFilterKey && extraFilter !== "All"
      ? `_${extraFilterKey.replace(/\s+/g,"")}-${String(extraFilter).replace(/\s+/g,"-")}` : "";
    a.download = `${subject}_${level}${extra}_${niceSheet}_Year-${year}_Grade-${String(grade).replace(/\s+/g, "-")}_Category-${String(category).replace(/\s+/g, "-")}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  /* ==================== render ==================== */
  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* header */}
      <div
        className="sticky top-0 z-20 backdrop-blur border-b"
        style={{ background: "rgba(255,255,255,0.9)", borderColor: "#e2e8f0" }}
      >
        <div className="max-w-7xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: BRAND.text }}>
            NY State Assessment - Created by DistrictArc
          </h1>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ background: "white", color: BRAND.text, borderColor: "#cbd5e1" }}
            >
              <Download size={16} /> Download CSV
            </button>
            <button
              onClick={() => location.reload()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ background: "white", color: BRAND.text, borderColor: "#cbd5e1" }}
            >
              <RefreshCcw size={16} /> Reset
            </button>
          </div>
        </div>

        {/* level chips */}
        <div style={{ background: "#f1f5f9" }}>
          <div className="max-w-7xl mx-auto px-4 pt-3 pb-2">
            <div className="flex flex-wrap items-center gap-8">
              {(["city","borough","district","school"] as const).map((lv) => {
                const active = level === lv;
                return (
                  <button
                    key={lv}
                    onClick={() => {
                      setLevel(lv);
                    }}
                    className="px-5 py-2 rounded-full border text-base font-medium transition"
                    style={{
                      background: active ? BRAND.primary : "white",
                      color: active ? "white" : BRAND.text,
                      borderColor: active ? BRAND.primary : "#cbd5e1",
                      boxShadow: active ? "0 1px 1px rgba(0,0,0,0.05)" : undefined,
                    }}
                    aria-pressed={active}
                  >
                    {lv[0].toUpperCase() + lv.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* filters row */}
          <div className="max-w-7xl mx-auto px-4 pb-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {level === "borough" && (
                  <Select
                    label="Borough"
                    value={extraFilter}
                    options={["All", ...extraOptionsAll]}
                    onChange={setExtraFilter}
                  />
                )}
                {level === "district" && (
                  <Select
                    label="District"
                    value={extraFilter}
                    options={["All", ...extraOptionsAll]}
                    onChange={setExtraFilter}
                  />
                )}
                {level === "school" && (
                  <SearchableCombo
                    label="School Name"
                    value={school}
                    options={["All", ...schoolNames]}
                    top5={[]}
                    onChange={(v) => { setSchool(v); setExtraFilter(v); }}
                  />
                )}

                <Select label="Table" value={sheetKey} options={sheetKeys.length ? sheetKeys : ["ELA - All"]} onChange={setSheetKey} />
                <Select label="Category" value={category} options={categories} onChange={setCategory} />
                <Select label="Year" value={String(year)} options={years} onChange={(v: string) => setYear(Number(v))} />
                <Select label="Grade" value={String(grade)} options={grades} onChange={setGrade} />
              </div>

              {/* subject segmented + mini actions */}
              <div className="col-span-12 lg:col-span-3 flex items-end lg:items-center justify-start lg:justify-end gap-2">
                <div className="inline-flex items-center rounded-xl border p-1"
                     style={{ borderColor: "#cbd5e1", background: "white" }}>
                  {(["ELA","Math"] as const).map((s) => {
                    const active = subject === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSubject(s)}
                        aria-pressed={active}
                        className="px-4 py-1.5 text-sm rounded-lg transition"
                        style={{
                          background: active ? BRAND.primaryDark : "transparent",
                          color: active ? "white" : BRAND.text,
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={downloadCSV}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border"
                  style={{ background: "white", color: BRAND.text, borderColor: "#cbd5e1" }}
                >
                  <Download size={16}/>
                </button>
                <button
                  onClick={() => location.reload()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border"
                  style={{ background: "white", color: BRAND.text, borderColor: "#cbd5e1" }}
                >
                  <RefreshCcw size={16}/>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* status banners */}
      {loading && (
        <div className="max-w-7xl mx-auto px-4 py-2 text-sm" style={{ color: BRAND.accent }}>
          Loading {subject} / {level}{level==="school" && school!=="All" ? ` / ${school}` : ""}…
        </div>
      )}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-2 text-sm" style={{ color: "#dc2626" }}>
          Error: {error}
        </div>
      )}
      {level === "school" && (!school || school === "All") && (
        <div className="max-w-7xl mx-auto px-4 py-3 text-sm" style={{ color: BRAND.textLight }}>
          Choose a specific school from <b>School Name</b> to load results. We only stream rows for the selected school.
        </div>
      )}

      {/* KPIs row */}
      <section className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card subtitle="Tested" title={
          <div className="text-3xl font-semibold" style={{ color: BRAND.text }}>
            {(tested || 0).toLocaleString()}
          </div>
        }>
          <div className="text-sm" style={{ color: BRAND.textLight }}>Year {year}</div>
        </Card>

        <Card subtitle="% Proficient (Lv 3+4)" title={
          <div className="text-3xl font-semibold" style={{ color: BRAND.primary }}>
            {pct34 != null ? `${round(pct34, 1)}%` : "—"}
          </div>
        }>
          <div className="text-sm" style={{ color: BRAND.textLight }}>Weighted by tested</div>
        </Card>

        <Card subtitle="Mean Scale Score" title={
          <div className="text-3xl font-semibold" style={{ color: BRAND.primary }}>
            {avgScaled != null ? round(avgScaled, 1) : "—"}
          </div>
        }>
          <div className="text-sm" style={{ color: BRAND.textLight }}>Weighted by tested</div>
        </Card>
      </section>

      {/* Trend by Year */}
      <section className="max-w-7xl mx-auto px-4 pb-4">
        <Card title="Trend by Year">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => `${Math.round(Number(v))}%`}
                  domain={[0, 100]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${Math.round(Number(v))}`}
                />
                <Tooltip
                  formatter={(v, name) =>
                    name === "% Proficient" ? `${round(Number(v), 1)}%` : `${round(Number(v), 1)}`
                  }
                  labelFormatter={(l) => `${l}`}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pct"
                  name="% Proficient"
                  strokeWidth={3}
                  dot={false}
                  stroke={COLORS[0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mean"
                  name="Mean Scale"
                  strokeWidth={3}
                  dot={false}
                  stroke={COLORS[3]}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Row: Grade bar, Levels pie, Levels stacked by year */}
      <section className="max-w-7xl mx-auto px-4 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={`Proficiency by Grade`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byGrade} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v))}%`} domain={[0, 100]} />
                <Tooltip formatter={(v) => `${round(Number(v), 1)}%`} />
                <Legend />
                <Bar dataKey="pct" name="% L3/4" radius={[6, 6, 0, 0]} fill={COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={`Levels`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={levelsPie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {levelsPie.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${round(Number(v), 1)}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={`Levels by Year — Stacked`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelsStacked} stackOffset="expand" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
                <Tooltip
                  formatter={(val: any, _name: any, ctx: any) => {
                    const p = ctx?.payload ?? {};
                    const total = (Number(p.L1) || 0) + (Number(p.L2) || 0) + (Number(p.L3) || 0) + (Number(p.L4) || 0);
                    const ratio = total > 0 ? Number(val) / total : 0;
                    return `${(ratio * 100).toFixed(1)}%`;
                  }}
                  labelFormatter={(l) => `${l}`}
                />
                <Legend />
                <Bar dataKey="L1" stackId="a" name="Level 1" fill={LEVEL_COLORS.L1} />
                <Bar dataKey="L2" stackId="a" name="Level 2" fill={LEVEL_COLORS.L2} />
                <Bar dataKey="L3" stackId="a" name="Level 3" fill={LEVEL_COLORS.L3} />
                <Bar dataKey="L4" stackId="a" name="Level 4" fill={LEVEL_COLORS.L4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Row: Caterpillar (rank) + Pareto + Heatmap */}
      <section className="max-w-7xl mx-auto px-4 pb-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title={level === "district" ? "District Rank — % L3/4" : level === "borough" ? "Borough Rank — % L3/4" : "Rank — % L3/4"}
          subtitle={`${category} · ${year} · ${String(grade)}`}
        >
          <div className="h-64">
            {caterpillar.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={caterpillar}
                  layout="vertical"
                  margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${Math.round(Number(v))}%`} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(v:any, _n:any, p:any)=> [`${round(Number(v),1)}%`, `N=${p?.payload?.n ?? 0}`]} />
                  <ReferenceLine x={(caterpillar.reduce((a,c)=>a+(c.pct||0),0)/ (caterpillar.length||1))} stroke="#64748b" strokeDasharray="3 3" label="avg" />
                  <Bar dataKey="pct" name="% L3/4" barSize={12} radius={[10,10,10,10]} fill={COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm" style={{ color: BRAND.textLight }}>
                Not available for this level.
              </div>
            )}
          </div>
        </Card>

        <Card title="Subgroup Pareto — % L3/4" subtitle={`${year} · ${String(grade)} · benchmark = All Students`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pareto.data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cat" tick={{ fontSize: 11 }} />
                <YAxis domain={[0,100]} tickFormatter={(v)=>`${Math.round(Number(v))}%`} />
                {pareto.benchmark != null && (
                  <ReferenceLine y={pareto.benchmark} stroke="#94a3b8" strokeDasharray="4 4" label="All Students" />
                )}
                <Tooltip formatter={(v)=>`${round(Number(v),1)}%`} />
                <Legend />
                <Bar dataKey="pct" name="% L3/4" radius={[6,6,0,0]} fill={COLORS[3]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Heatmap — % L3/4" subtitle={`${category} · Years × Grades`}>
          <div className="p-2">
            <div className="overflow-auto">
              <table className="min-w-full border-separate" style={{ borderSpacing: 4 }}>
                <thead>
                  <tr>
                    <th className="text-xs text-left" style={{ color: BRAND.textLight }}>Year ↓ / Grade →</th>
                    {heatmap.grades.map((g) => (
                      <th key={String(g)} className="text-xs px-2 text-center" style={{ color: BRAND.text }}>{String(g)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.years.map((y) => (
                    <tr key={y}>
                      <td className="text-xs pr-2" style={{ color: BRAND.text }}>{y}</td>
                      {heatmap.grades.map((g) => {
                        const v = heatmap.val(y, g);
                        const alpha = v == null ? 0 : Math.min(1, Math.max(0.1, v / 100));
                        const bg = `rgba(34,197,94,${alpha})`; // emerald scale
                        return (
                          <td key={String(g)} className="text-[11px] text-center rounded"
                              style={{ backgroundColor: v==null ? "#f1f5f9" : bg, color: BRAND.text, padding: "6px 8px", minWidth: 40 }}>
                            {v==null ? "—" : `${Math.round(v)}%`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </section>

      {/* === Footer copyright === */}
      <footer className="border-t" style={{ borderColor: "#e2e8f0", background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs" style={{ color: BRAND.textLight }}>
          © {new Date().getFullYear()} <span style={{ color: BRAND.primaryDark, fontWeight: 600 }}>District Arc</span>. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
