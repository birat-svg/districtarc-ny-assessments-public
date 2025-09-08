// app/ny-assessments-public/api/assessments/route.ts
import { NextResponse } from "next/server";

// If you ever switch this to Edge, use fetch() to the public paths instead of fs.
// Here we just read static JSON via fetch to a public URL so there’s no fs dependency.
const BASE = "/ny-assessments-public";

// helper to JSON-fetch from public files and return {}
async function getJsonFromPublic(path: string) {
  try {
    const res = await fetch(`${BASE}/${path}`, { cache: "force-cache" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const subject = (searchParams.get("subject") || "ELA").trim();
  const level = (searchParams.get("level") || "city").trim().toLowerCase();
  const wantNames = searchParams.has("names");
  const school = (searchParams.get("school") || "").trim();

  try {
    // === School names (from prebuilt JSON) ===
    if (level === "school" && wantNames) {
      // public/ny-assessments-public/school-names.json
      const data = await getJsonFromPublic("school-names.json");
      const names = Array.isArray((data as any).names) ? (data as any).names : [];
      return NextResponse.json(
        { names },
        { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=86400" } }
      );
    }

    // === School payload for a selected name (from prebuilt JSON) ===
    if (level === "school") {
      if (!school || school === "All") {
        return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
      }

      // We’ll use the same slug transform as the build script: filename-safe
      const slug = school
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      // public/ny-assessments-public/schools/<slug>.json
      const payload = await getJsonFromPublic(`schools/${slug}.json`);
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    }

    // === City / Borough / District (optional prebuilt files) ===
    // If you don’t have these prebuilt, the page will still work for city/borough/district
    // if it fetches via the API. To support that, place static JSONs here:
    // public/ny-assessments-public/data/<subject>/<level>.json
    const staticPath = `data/${subject}/${level}.json`;
    const payload = await getJsonFromPublic(staticPath);

    // If missing, return an empty object instead of error (UI handles it)
    return NextResponse.json(
      payload,
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" } }
    );
  } catch (e: any) {
    console.error("[/ny-assessments-public/api/assessments] error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
