// Copernicus Data Space Ecosystem (CDSE) — ортақ OAuth токені.
//
// Бұрын бірдей токен логикасы 4 жерде қайталанған еді (oil-scan, s5p,
// sentinelStats, floodSar). Әрқайсысының кэші бөлек болғандықтан бір
// сұраныста 4 рет токен алынуы мүмкін еді. Енді біреу — процесс ішінде
// ортақ кэшпен.

const TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

export const SH_STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";
export const SH_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";

let cache: { token: string; exp: number } | null = null;
let inflight: Promise<string> | null = null;

export function hasCdseKeys(): boolean {
  return Boolean(process.env.SENTINELHUB_CLIENT_ID && process.env.SENTINELHUB_CLIENT_SECRET);
}

/**
 * Жарамды токен қайтарады. Кілттер жоқ болса — қате көтереді
 * (шақырушы 503 қайтаруы керек, жалған дерек емес).
 */
export async function cdseToken(): Promise<string> {
  const id = process.env.SENTINELHUB_CLIENT_ID;
  const secret = process.env.SENTINELHUB_CLIENT_SECRET;
  if (!id || !secret) throw new Error("CDSE кілттері бапталмаған");

  // 120 с қор — сұраныс жүріп жатқанда мерзімі бітпеуі үшін
  if (cache && Date.now() < cache.exp - 120_000) return cache.token;
  // Қатар келген сұраныстар бір токенді күтеді, әрқайсысы бөлек сұрамайды
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: id,
          client_secret: secret,
        }).toString(),
      });
      if (!res.ok) throw new Error(`CDSE token ${res.status}`);
      const d = (await res.json()) as { access_token: string; expires_in: number };
      cache = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
      return d.access_token;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Кілт жоқ болса null — «қолжетімсіз» деп өңдеу оңай болу үшін. */
export async function cdseTokenOrNull(): Promise<string | null> {
  if (!hasCdseKeys()) return null;
  try {
    return await cdseToken();
  } catch {
    return null;
  }
}
