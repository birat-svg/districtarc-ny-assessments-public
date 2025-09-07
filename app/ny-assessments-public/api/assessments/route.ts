// app/api/assessments/route.ts
import { NextResponse } from "next/server";
import { loadAssessments, getSchoolNames, loadSchoolForName } from "@/lib/loadAssessments";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject") || "ELA";
  const level = (searchParams.get("level") || "city").toLowerCase();

  try {
    // quick school-names endpoint
    if (level === "school" && searchParams.get("names")) {
      const names = await getSchoolNames(subject);
      return NextResponse.json({ names });
    }

    // small school payload for a specific school
    if (level === "school") {
      const school = searchParams.get("school");
      if (!school || school === "All") {
        // empty result when no specific school is selected (client shows prompt)
        return NextResponse.json({});
      }
      const payload = await loadSchoolForName(subject, school);
      return NextResponse.json(payload);
    }

    // normal (city/borough/district)
    const payload = await loadAssessments(subject, level);
    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("[/api/assessments] error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
