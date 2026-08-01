import { NextResponse } from "next/server";
import OpenAI from "openai";
import { allow } from "@/lib/ratelimit";
import { cdseToken, hasCdseKeys } from "@/lib/cdse";

// Мұнай дағын АНЫҚТАУ (AI-көмекші) — Sentinel-1 SAR + GPT-4o vision.
// SAR-да тегіс су мен мұнай дағы КҮҢГІРТ көрінеді. Нақты операциялық
// классификатор үйретілген ML моделін керек етеді — бізде ол жоқ. Сондықтан
// бұл РАСТАЛҒАН детекция ЕМЕС: GPT күдікті қара дақтарды белгілеп, сенімсіздігін
// ашық айтады. Дереккөз (SAR суреті) нақты, қорытынды — болжам.

// Sentinel-1 VV дБ сұр-шкала (қара = тегіс су / ықтимал мұнай)
const EVALSCRIPT = `//VERSION=3
function setup() { return { input: ["VV"], output: { bands: 1 } }; }
function evaluatePixel(s) {
  var db = 10 * Math.log(s.VV) / Math.LN10;
  var v = Math.max(0, Math.min(1, (db + 25) / 25));
  return [v];
}`;

export async function GET(req: Request) {
  if (!(await allow(req, "oil-scan"))) {
    return NextResponse.json({ error: "Тым көп сұраныс. Сәл кейін қайталаңыз." }, { status: 429 });
  }
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Жарамсыз координата" }, { status: 400 });
  }
  if (!hasCdseKeys()) {
    return NextResponse.json({ available: false, reason: "Sentinel Hub кілттері бапталмаған" });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ available: false, reason: "AI кілті жоқ — SAR суретін талдау мүмкін емес" });
  }

  const half = 0.12; // ~13 км аймақ
  const bbox = [lng - half, lat - half, lng + half, lat + half];

  try {
    const token = await cdseToken();
    const body = {
      input: {
        bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
        data: [
          {
            type: "sentinel-1-grd",
            dataFilter: {
              timeRange: {
                from: new Date(Date.now() - 30 * 86400_000).toISOString(),
                to: new Date().toISOString(),
              },
              acquisitionMode: "IW",
              polarization: "DV",
            },
            processing: { backCoeff: "SIGMA0_ELLIPSOID", orthorectify: true },
          },
        ],
      },
      output: { width: 512, height: 512, responses: [{ identifier: "default", format: { type: "image/png" } }] },
      evalscript: EVALSCRIPT,
    };

    const imgRes = await fetch("https://sh.dataspace.copernicus.eu/api/v1/process", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "image/png" },
      body: JSON.stringify(body),
    });
    if (!imgRes.ok) {
      const t = await imgRes.text();
      console.error("Oil-scan SAR error:", imgRes.status, t.slice(0, 200));
      return NextResponse.json({ error: "SAR суреті қолжетімсіз (осы аймақта Sentinel-1 өтуі болмауы мүмкін)" }, { status: 503 });
    }
    const buf = await imgRes.arrayBuffer();
    const dataUrl = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Сен Sentinel-1 радар (SAR) суреттерін талдайтын экология AI-сың. SAR-да тегіс су КҮҢГІРТ (қара), кедір-бұдыр су АҚШЫЛ болады. Мұнай дағы толқынды басады → КҮҢГІРТ дақ. Бірақ тыныш жел, жел көлеңкесі, тұщы су да күңгірт болуы мүмкін. Тек осы суретке қарап баға. Бұл РАСТАЛҒАН детекция ЕМЕС — сенімсіздігіңді ашық айт. Тек JSON, қазақша.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Осы Каспий/Жайық аймағының SAR суретінде мұнай дағына ұқсас күдікті қара дақ бар ма? JSON: {"suspected":bool,"confidence":0-100,"description":"не көрінеді","caveat":"неге сенімсіз"}` },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });
    const ai = JSON.parse(completion.choices[0].message.content ?? "{}");

    return NextResponse.json({
      available: true,
      lat, lng,
      source: "Sentinel-1 SAR (ESA Copernicus) · GPT-4o vision",
      suspected: !!ai.suspected,
      confidence: typeof ai.confidence === "number" ? ai.confidence : null,
      description: ai.description ?? "",
      caveat: ai.caveat ?? "Расталған детекция емес — нақты тексеру қажет.",
      imageUrl: dataUrl,
    });
  } catch (err) {
    console.error("Oil-scan error:", err);
    return NextResponse.json({ error: "Мұнай сканері уақытша қолжетімсіз" }, { status: 503 });
  }
}
