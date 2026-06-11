import { NextResponse } from "next/server";

import { fetchFootballDataMatches } from "@/lib/football-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const response = await fetchFootballDataMatches({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load matches.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
