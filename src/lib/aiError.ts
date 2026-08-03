import OpenAI from "openai";

// AI ШАҚЫРУЫ НЕГЕ СӘТСІЗ БОЛҒАНЫН НАҚТЫ АЙТУ.
//
// ═══ НЕГЕ КЕРЕК ═══
// Бұрын `catch` блогы қатені тек `console.error` арқылы жазатын да,
// пайдаланушыға «AI уақытша қолжетімсіз» деген жалпы сөйлем көрсететін.
// Нәтижесінде кілт жарамсыз ба, баланс бітті ме, әлде сурет жүктелмеді ме —
// сырттан қарап АЖЫРАТУ МҮМКІН ЕМЕС еді.
//
// ═══ ҚАҒИДА ═══
// «Ойдан дерек жасамау» қағидасы себепті ЖАСЫРУҒА да қатысты: жүйе неге
// істемей тұрғанын білсе, соны айтуы керек. Бұл — жалған талдау қайтару
// емес, тек ақаудың себебі.
//
// ═══ ҚАУІПСІЗДІК ═══
// Қайтарылатын мәтінде ЕШҚАШАН кілт, токен немесе ішкі стек болмайды —
// тек алдын ала жазылған қазақша сөйлемдер. OpenAI-дың өз мәтіні
// қайталанбайды (онда кейде сұраныс мазмұны болады).

/** Машина оқитын себеп коды — UI-де қажет болса ажырату үшін */
export type AiFailureCode =
  | "no-key"
  | "bad-key"
  | "no-access"
  | "no-quota"
  | "rate-limited"
  | "image-unreachable"
  | "content-filtered"
  | "upstream-down"
  | "network"
  | "timeout"
  | "unknown";

export interface AiFailure {
  code: AiFailureCode;
  /** Пайдаланушыға көрсетілетін қазақша себеп (бір сөйлем) */
  reason: string;
  /** Нені түзету керек — әкімшіге арналған нақты қадам */
  fix: string;
}

const FAILURES: Record<AiFailureCode, Omit<AiFailure, "code">> = {
  "no-key": {
    reason: "OPENAI_API_KEY бапталмаған.",
    fix: "Vercel → Settings → Environment Variables ішіне кілтті қосып, қайта деплой жасаңыз.",
  },
  "bad-key": {
    reason: "OpenAI кілті жарамсыз немесе күші жойылған (401).",
    fix: "platform.openai.com/api-keys бетінен жаңа кілт жасап, Vercel-дегі OPENAI_API_KEY мәнін ауыстырыңыз.",
  },
  "no-access": {
    reason: "Кілтке сұралған модельге (gpt-4o) рұқсат берілмеген.",
    fix: "OpenAI жобасының Limits бөлімінде gpt-4o моделі қосулы екенін тексеріңіз.",
  },
  "no-quota": {
    reason: "OpenAI шотында қаражат/квота бітті — сұраныс қабылданбады.",
    fix: "platform.openai.com/settings/organization/billing бетінен балансты толтырыңыз.",
  },
  "rate-limited": {
    reason: "OpenAI сұраныс шегіне жетті (429) — тым жиі шақырылды.",
    fix: "Бір-екі минуттан кейін қайталаңыз.",
  },
  "image-unreachable": {
    reason: "OpenAI спутник суретін жүктей алмады — сурет сілтемесі қолжетімсіз.",
    fix: "NEXT_PUBLIC_MAPBOX_TOKEN жарамды ма және Mapbox Static Images API квотасы бар ма — тексеріңіз.",
  },
  "content-filtered": {
    reason: "Сұраныс OpenAI мазмұн сүзгісінен өтпеді.",
    fix: "Басқа нүктені таңдап көріңіз; қайталанса, промптты қайта қарау керек.",
  },
  "upstream-down": {
    reason: "OpenAI сервері уақытша жауап бермеді (5xx).",
    fix: "Бұл — OpenAI жағындағы ақау. Бірнеше минуттан кейін қайталаңыз.",
  },
  network: {
    reason: "OpenAI-ға желі байланысы орнамады.",
    fix: "Серверден шығыс интернет бар ма — тексеріңіз.",
  },
  timeout: {
    reason: "OpenAI жауабы уақыт шегінен асып кетті.",
    fix: "Қайталап көріңіз; жиі болса, функцияның maxDuration мәнін ұлғайту керек.",
  },
  unknown: {
    reason: "AI қызметі күтпеген қате қайтарды.",
    fix: "Vercel → Logs бөлімінен нақты қатені қараңыз.",
  },
};

function codeOf(err: unknown): AiFailureCode {
  if (err instanceof OpenAI.APIConnectionTimeoutError) return "timeout";
  if (err instanceof OpenAI.APIConnectionError) return "network";

  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    // `code` — OpenAI-дың машиналық коды (insufficient_quota, invalid_api_key, …)
    const code = String(err.code ?? "");
    // Мәтін тек ҮЛГІ ТАНУ үшін оқылады, ешқайда қайтарылмайды
    const msg = String(err.message ?? "").toLowerCase();

    if (code === "insufficient_quota" || msg.includes("insufficient_quota")) return "no-quota";
    if (status === 401 || code === "invalid_api_key") return "bad-key";
    if (status === 403 || code === "model_not_found" || status === 404) return "no-access";
    if (status === 429) return "rate-limited";
    if (msg.includes("downloading image") || msg.includes("invalid image") || msg.includes("image_url"))
      return "image-unreachable";
    if (code === "content_policy_violation" || msg.includes("content policy")) return "content-filtered";
    if (status >= 500) return "upstream-down";
    return "unknown";
  }

  // OpenAI SDK-дан тыс қателер (мыс. JSON.parse) — тек жалпы код
  return "unknown";
}

/**
 * OpenAI қатесін пайдаланушыға көрсетуге ЖАРАМДЫ себепке айналдырады.
 * Құпия дерек қайтармайды: тек жоғарыдағы тұрақты мәтіндер.
 */
export function aiFailure(err: unknown): AiFailure {
  const code = codeOf(err);
  return { code, ...FAILURES[code] };
}

/**
 * `detail` жолына қосу үшін дайын сөйлем: «Себебі: … Түзету: …».
 * Бұрынғы «жалған дерек жасалмайды» мәтінінің АЛДЫНА қойылады.
 */
export function aiFailureText(err: unknown): string {
  const f = aiFailure(err);
  return `Себебі: ${f.reason} Түзету: ${f.fix}`;
}
