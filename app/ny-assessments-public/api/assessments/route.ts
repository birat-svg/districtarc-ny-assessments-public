// app/ny-assessments-public/api/assessments/route.ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import {
  loadAssessments,
  getSchoolNames,
  loadSchoolForName,
} from "@/lib/loadAssessments";

function normalizeSubject(s: string) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "ela") return "ELA";
  if (v === "math" || v === "mathematics" || v === "m") return "Math";
  throw new Error(`Invalid subject "${s}"`);
}
function slugify(name: string) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const subjectIn = (searchParams.get("subject") || "ELA").trim();
  const subject = normalizeSubject(subjectIn); // "ELA" | "Math"

  const level = (searchParams.get("level") || "city").trim().toLowerCase();
  const wantNames = searchParams.has("names");
  const school = (searchParams.get("school") || "").trim();

  try {
    // names list
    if (level === "school" && wantNames) {
      const names = await getSchoolNames(subject);
      return NextResponse.json(
        { names },
        { headers: { "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400" } }
      );
    }

    // single school payload → try static JSON first
    if (level === "school") {
      if (!school || school === "All") {
        return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
      }

      const filePath = path.join(
        process.cwd(),
        "public",
        "ny-assessments-public",
        "schools",
        subject,
        `${slugify(school)}.json`
      );

      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        // lightweight caching is okay; file contents only change when you redeploy
        return new NextResponse(buf, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      }

      // fallback (dev safety) — dynamic XLSX read (slow on Netlify, fine locally)
      const payload = await loadSchoolForName(subject, school);
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    }

    // city / borough / district
    const payload = await loadAssessments(subject, level);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (e: any) {
    console.error("[/ny-assessments-public/api/assessments] error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
