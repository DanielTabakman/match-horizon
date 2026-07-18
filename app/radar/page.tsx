import RadarClient from "./RadarClient";
import { loadMarketRadarSnapshot } from "../../src/lib/marketRadar/loadRadar";

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  return <RadarClient initialSnapshot={await loadMarketRadarSnapshot()} />;
}
