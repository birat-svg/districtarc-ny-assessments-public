// app/ny-assessments-public/api/assessments/route.ts
import { NextResponse } from "next/server";
import {
  loadAssessments,
  getSchoolNames,
  loadSchoolForName,
} from "@/lib/loadAssessments";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // inputs
  const subject = (searchParams.get("subject") || "ELA").trim();
  const level = (searchParams.get("level") || "city").trim().toLowerCase();
  const wantNames = searchParams.has("names"); // ?names=1
  const school = (searchParams.get("school") || "").trim();

  try {
    // --- return only school names (fast; from public JSON) ---
    if (level === "school" && wantNames) {
      const names = await getSchoolNames(subject);
      // Cache lightly at the edge; users can still refresh with SWR.
      return NextResponse.json(
        { names },
        { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=86400" } }
      );
    }

    // --- load rows for a single selected school (small payload) ---
    if (level === "school") {
      if (!school || school === "All") {
        // UI expects empty object when no school picked
        return NextResponse.json(
          {},
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      const payload = await loadSchoolForName(subject, school);
      return NextResponse.json(
        payload,
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // --- city / borough / district ---
    const payload = await loadAssessments(subject, level);
    return NextResponse.json(
      payload,
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" } }
    );
  } catch (e: any) {
    console.error("[/ny-assessments-public/api/assessments] error:", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
