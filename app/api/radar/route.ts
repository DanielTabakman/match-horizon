import { NextResponse } from "next/server";
import { loadMarketRadarSnapshot } from "../../../src/lib/marketRadar/loadRadar";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadMarketRadarSnapshot());
}
