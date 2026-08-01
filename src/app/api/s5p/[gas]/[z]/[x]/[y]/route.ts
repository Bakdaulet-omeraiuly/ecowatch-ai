import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cdseToken } from "@/lib/cdse";

// Sentinel-5P/TROPOMI тайл прокси (Process API)
// Tile z/x/y → EPSG:3857 bbox → Sentinel Hub → PNG жауап

// XYZ тайл координаттарын EPSG:3857 bbox-ке түрлендіру
function tileToBbox(z: number, x: number, y: number) {
  const size = (20037508.342789244 * 2) / Math.pow(2, z);
  const minX = x * size - 20037508.342789244;
  const maxX = minX + size;
  const maxY = 20037508.342789244 - y * size;
  const minY = maxY - size;
  return [minX, minY, maxX, maxY];
}

// Әр газдың evalscript-і және деректер диапазоны
// S5P нативті бірліктері: NO2/SO2 mol/m², CH4 ppb, CO mol/m², AER_AI өлшемсіз
const GAS_CONFIG: Record<string, { bands: string[]; evalscript: string }> = {
  no2: {
    bands: ["NO2"],
    evalscript: `//VERSION=3
function setup() {
  return { input: [{ bands: ["NO2"] }], output: { bands: 4, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  if (s.NO2 < 0) return [0,0,0,0];
  // NO2 нативті бірлігі mol/m² (~0–0.0002 мол/м²)
  let v = Math.min(1, s.NO2 / 0.0002);
  let r,g,b;
  if (v < 0.25) { r=0; g=0; b=Math.round(100+v*4*155); }
  else if (v < 0.5) { r=0; g=Math.round((v-0.25)*4*255); b=255; }
  else if (v < 0.75) { r=Math.round((v-0.5)*4*255); g=255; b=Math.round(255-(v-0.5)*4*255); }
  else { r=255; g=Math.round(255-(v-0.75)*4*255); b=0; }
  let a = v < 0.015 ? 0 : Math.round(180 + v*75);
  return [r,g,b,a];
}`,
  },
  so2: {
    bands: ["SO2"],
    evalscript: `//VERSION=3
function setup() {
  return { input: [{ bands: ["SO2"] }], output: { bands: 4, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  if (s.SO2 < 0) return [0,0,0,0];
  // SO2 нативті бірлігі mol/m² (~0–0.005)
  let v = Math.min(1, s.SO2 / 0.005);
  let r,g,b;
  if (v < 0.3) { r=150; g=0; b=Math.round(200+v*3*55); }
  else if (v < 0.6) { r=200; g=Math.round((v-0.3)*3*100); b=255; }
  else { r=255; g=Math.round(100+(v-0.6)*2.5*155); b=0; }
  let a = v < 0.015 ? 0 : Math.round(170 + v*85);
  return [r,g,b,a];
}`,
  },
  ch4: {
    bands: ["CH4"],
    evalscript: `//VERSION=3
function setup() {
  return { input: [{ bands: ["CH4"] }], output: { bands: 4, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  if (s.CH4 <= 0) return [0,0,0,0];
  // CH4 нативті бірлігі ppb (~1750–1950 ppb)
  let v = Math.min(1, Math.max(0, (s.CH4 - 1750) / 180));
  let r,g,b;
  if (v < 0.33) { r=0; g=Math.round(v*3*180); b=Math.round(80+v*3*100); }
  else if (v < 0.66) { r=Math.round((v-0.33)*3*255); g=200; b=0; }
  else { r=255; g=Math.round(200-(v-0.66)*3*200); b=0; }
  let a = v < 0.005 ? 0 : Math.round(160 + v*95);
  return [r,g,b,a];
}`,
  },
  co: {
    bands: ["CO"],
    evalscript: `//VERSION=3
function setup() {
  return { input: [{ bands: ["CO"] }], output: { bands: 4, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  if (s.CO < 0) return [0,0,0,0];
  // CO нативті бірлігі mol/m² (~0.01–0.1)
  let v = Math.min(1, s.CO / 0.06);
  let r,g,b;
  if (v < 0.4) { r=Math.round(v*2.5*255); g=Math.round(180-v*2.5*180); b=0; }
  else { r=255; g=0; b=Math.round((v-0.4)*1.67*180); }
  let a = v < 0.02 ? 0 : Math.round(150 + v*105);
  return [r,g,b,a];
}`,
  },
  aod: {
    bands: ["AER_AI_340_380"],
    evalscript: `//VERSION=3
function setup() {
  return { input: [{ bands: ["AER_AI_340_380"] }], output: { bands: 4, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  // AER_AI өлшемсіз (-1 ден +5 дейін)
  let v = Math.min(1, Math.max(0, (s.AER_AI_340_380 + 0.5) / 5));
  let r,g,b;
  if (v < 0.5) { r=0; g=Math.round(v*2*220); b=Math.round(180-v*2*180); }
  else { r=Math.round((v-0.5)*2*255); g=220; b=0; }
  let a = v < 0.04 ? 0 : Math.round(140 + v*115);
  return [r,g,b,a];
}`,
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gas: string; z: string; x: string; y: string }> }
) {
  const { gas, z, x, y } = await params;
  const cfg = GAS_CONFIG[gas];
  if (!cfg) return new NextResponse("Unknown gas", { status: 400 });

  const zi = parseInt(z), xi = parseInt(x), yi = parseInt(y);
  if (isNaN(zi) || isNaN(xi) || isNaN(yi)) return new NextResponse("Bad tile", { status: 400 });

  // Zoom тым үлкен болса S5P деректері мағынасыз (5.5 км пиксель) — overzoom болады
  if (zi > 10) return new NextResponse(null, { status: 204 });
  // Тым кішкентай zoom-да жер шарының үлкен бөлігі — API квотасын үнемдеу
  if (zi < 3) return new NextResponse(null, { status: 204 });

  const [minX, minY, maxX, maxY] = tileToBbox(zi, xi, yi);

  try {
    const token = await cdseToken();

    const body = {
      input: {
        bounds: {
          bbox: [minX, minY, maxX, maxY],
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/3857" },
        },
        data: [
          {
            type: "sentinel-5p-l2",
            dataFilter: {
              timeRange: {
                from: new Date(Date.now() - 7 * 86400_000).toISOString(),
                to: new Date(Date.now() - 86400_000).toISOString(),
              },
              minQa: 50,
            },
          },
        ],
      },
      output: {
        width: 512,
        height: 512,
        responses: [{ identifier: "default", format: { type: "image/png" } }],
      },
      evalscript: cfg.evalscript,
    };

    const res = await fetch("https://sh.dataspace.copernicus.eu/api/v1/process", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`S5P [${gas}] tile ${z}/${x}/${y} error ${res.status}:`, err.slice(0, 200));
      return new NextResponse(null, { status: 204 });
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=21600", // 6 сағат кэш
      },
    });
  } catch (e) {
    console.error("S5P tile error:", e);
    return new NextResponse(null, { status: 204 });
  }
}
