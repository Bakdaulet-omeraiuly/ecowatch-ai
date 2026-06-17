// Sentinel Hub Statistical API — таңдалған нүкте/аумаққа НАҚТЫ есептелген
// спектрлік индекстер (NDVI, NDWI, NDMI, NDBI). Бұл — «ML» (классикалық
// қашықтан зондтау) нәтижесі, GPT-4o Vision-ға қосымша. Жалған дерек жоқ.

const TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.SENTINELHUB_CLIENT_ID;
  const secret = process.env.SENTINELHUB_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
  return tokenCache.token;
}

const EVALSCRIPT = `//VERSION=3
function setup(){return{input:[{bands:["B03","B04","B08","B11","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"ndwi",bands:1,sampleType:"FLOAT32"},{id:"ndmi",bands:1,sampleType:"FLOAT32"},{id:"ndbi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){let ndvi=(s.B08-s.B04)/(s.B08+s.B04);let ndwi=(s.B03-s.B08)/(s.B03+s.B08);let ndmi=(s.B08-s.B11)/(s.B08+s.B11);let ndbi=(s.B11-s.B08)/(s.B11+s.B08);return{ndvi:[ndvi],ndwi:[ndwi],ndmi:[ndmi],ndbi:[ndbi],dataMask:[s.dataMask]};}`;

export interface MlIndices {
  ndvi: number; ndwi: number; ndmi: number; ndbi: number;
  from: string; to: string;
}

export async function computeIndices(lat: number, lng: number, areaKm2?: number): Promise<MlIndices | null> {
  const token = await getToken();
  if (!token) return null;

  // Аумаққа сай шаршы (км) → градус. Әдепкі ~1 км.
  const sideKm = areaKm2 && areaKm2 > 0 ? Math.min(Math.sqrt(areaKm2), 20) : 1;
  const halfLat = (sideKm / 2) / 111;
  const halfLng = halfLat / Math.cos((lat * Math.PI) / 180);
  const bbox = [lng - halfLng, lat - halfLat, lng + halfLng, lat + halfLat];

  // Пиксель ~10-20 м, бірақ 1500 м/пиксель шегінен аспау
  const spanDeg = 2 * halfLng;
  const res = Math.max(0.0001, Math.min(0.012, spanDeg / 800));

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);

  const body = {
    input: {
      bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
      data: [{ type: "sentinel-2-l2a", dataFilter: { maxCloudCoverage: 40 } }],
    },
    aggregation: {
      timeRange: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
      aggregationInterval: { of: "P60D" },
      resx: res, resy: res,
      evalscript: EVALSCRIPT,
    },
  };

  try {
    const res2 = await fetch(STATS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res2.ok) { console.error("Stats API:", await res2.text()); return null; }
    const j = await res2.json();
    const out = j?.data?.[0]?.outputs;
    const interval = j?.data?.[0]?.interval;
    if (!out) return null;
    const mean = (k: string) => out[k]?.bands?.B0?.stats?.mean ?? null;
    const ndvi = mean("ndvi"), ndwi = mean("ndwi"), ndmi = mean("ndmi"), ndbi = mean("ndbi");
    if (ndvi == null) return null;
    return {
      ndvi: +ndvi.toFixed(3), ndwi: +ndwi.toFixed(3),
      ndmi: +ndmi.toFixed(3), ndbi: +ndbi.toFixed(3),
      from: interval?.from?.slice(0, 10) ?? from,
      to: interval?.to?.slice(0, 10) ?? to,
    };
  } catch (e) {
    console.error("computeIndices error:", e);
    return null;
  }
}
