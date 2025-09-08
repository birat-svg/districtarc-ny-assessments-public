// app/ny-assessments-public/api/assessments/route.ts
import { NextResponse } from "next/server";
import {
  loadAssessments,
  getSchoolNames,
  loadSchoolForName,
} from "@/lib/loadAssessments";

/** Force dynamic execution (no ISR/prerender), avoid Edge caching. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // inputs
  const subject = (searchParams.get("subject") || "ELA").trim();
  const level = (searchParams.get("level") || "city").trim().toLowerCase();
  const wantNames = searchParams.has("names"); // ?names=1
  const school = (searchParams.get("school") || "").trim();

  try {
    // --- return only school names (served from public JSON / fast path) ---
    if (level === "school" && wantNames) {
      const names = await getSchoolNames(subject);
      return noStoreJson({ names });
    }

    // --- load rows for a single selected school (small payload) ---
    if (level === "school") {
      if (!school || school === "All") {
        // UI expects empty object when no school picked
        return noStoreJson({});
      }
      const payload = await loadSchoolForName(subject, school);
      return noStoreJson(payload);
    }

    // --- city / borough / district ---
    const payload = await loadAssessments(subject, level);
    return noStoreJson(payload);
  } catch (e: any) {
    console.error("[/ny-assessments-public/api/assessments] error:", e);
    return noStoreJson({ error: e?.message || "Server error" }, 500);
  }
}
