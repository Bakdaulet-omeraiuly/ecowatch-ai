// ДАЛАЛЫҚ ЖУРНАЛ: GET ?layer= (тізім), POST (жаңа жазба). Тек scientist/officer/admin.
// RLS дерекқорда да тексереді (20261105_map_tools.sql); кесте жоқ → 503.
import { NextResponse } from "next/server";
import { JOURNAL_ROLES, requireRole } from "@/lib/auth";
import { JOURNAL_LAYERS, JOURNAL_UNAVAILABLE, LAYER_LABELS, kindSpec, validateEntry, type JournalLayer } from "@/lib/fieldJournal";
import { toCsv, withProvenance, csvHeaders, type Cell } from "@/lib/csv";

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });
const COLS = "id, user_id, layer, kind, geom, lat, lng, area_km2, event_date, status, fields, note, created_at, updated_at";

export async function GET(req: Request) {
  const auth = await requireRole(req, JOURNAL_ROLES);
  if (!auth.ok) return auth.response;
  const layer = new URL(req.url).searchParams.get("layer");
  if (layer && !JOURNAL_LAYERS.includes(layer as JournalLayer)) return fail("Қабат белгісіз", 400);
  try {
    let q = auth.client.from("field_entries").select(COLS);
    if (layer) q = q.eq("layer", layer);
    const { data, error } = await q.order("event_date", { ascending: false }).limit(500);
    if (error || !data) return fail(JOURNAL_UNAVAILABLE, 503);
    if (new URL(req.url).searchParams.get("format") === "csv") {
      const rows: Cell[][] = data.map((e) => {
        const spec = kindSpec(e.kind);
        const st = spec?.statusLabels[e.status as keyof typeof spec.statusLabels] ?? e.status;
        const fields = Object.entries((e.fields ?? {}) as Record<string, unknown>)
          .map(([k, v]) => `${spec?.fields.find((f) => f.key === k)?.label ?? k}: ${v}`).join("; ");
        return [e.event_date, LAYER_LABELS[e.layer as JournalLayer] ?? e.layer, spec?.label ?? e.kind, st, e.lat, e.lng,
          e.area_km2 == null ? null : +(e.area_km2 * 100).toFixed(3), fields, e.note, e.created_at];
      });
      const body = withProvenance([["Күні", "Қабат", "Түрі", "Мәртебе", "Ендік", "Бойлық", "Аудан, га", "Өрістер", "Ескерту", "Жазылған (UTC)"], ...rows], {
        dataset: `Далалық журнал${layer ? `: ${LAYER_LABELS[layer as JournalLayer]}` : ""} (${rows.length} жазба)`,
        tier: "Өлшем", source: "Jaiyq далалық журналы — қызметкер/ғалым енгізген жазбалар", fetchedAt: new Date().toISOString(),
        caveats: ["Жазбаларды рөлі бар пайдаланушылар енгізеді; сайт оларды тәуелсіз тексермейді.", "Отырғызу NDVI тексеруі — спутник индексі, жердегі растау емес."],
      });
      return new NextResponse(toCsv(body), { headers: csvHeaders(`jaiyq-journal-${layer ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`) });
    }
    return NextResponse.json({ entries: data, me: auth.user.id, role: auth.role }, { headers: noStore });
  } catch {
    return fail(JOURNAL_UNAVAILABLE, 503);
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(req, JOURNAL_ROLES);
  if (!auth.ok) return auth.response;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("JSON жарамсыз", 400); }
  const check = validateEntry(body);
  if (!check.ok) return fail(check.error, 400);
  try {
    const { data, error } = await auth.client.from("field_entries")
      .insert({ ...check.row, user_id: auth.user.id }).select(COLS).single();
    if (error || !data) return fail(JOURNAL_UNAVAILABLE, 503);
    return NextResponse.json({ entry: data }, { status: 201, headers: noStore });
  } catch {
    return fail(JOURNAL_UNAVAILABLE, 503);
  }
}
