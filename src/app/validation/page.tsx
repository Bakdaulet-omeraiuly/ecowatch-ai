import { pageMeta } from "@/lib/seo";
import { buildValidationChecks } from "@/lib/validationResults";
import { ValidationView } from "@/components/validation/ValidationView";

// ВАЛИДАЦИЯ БЕТІ — әр модуль мен әр газ бөлек, оң және теріс нәтижемен.
// Деректер validation/*/results.json-нан ҚҰРЫЛАДЫ (статикалық, build уақытында).
// Шектер протоколдан көшірілген (validationResults.ts). Мок дерек жоқ.
export const metadata = pageMeta({
  title: "Валидация: нәтижелер (оң және теріс)",
  description:
    "CAMS PM₂.₅, Қазгидромет газдары, Sentinel-5P және VIIRS тексерулерінің нәтижелері: әр шек, сан және өтті/өтпеді күйі. Теріс нәтижелер де жарияланады.",
  path: "/validation",
  keywords: ["валидация", "CAMS", "Қазгидромет", "Sentinel-5P", "VIIRS", "эталон"],
});

export default function ValidationPage() {
  return <ValidationView checks={buildValidationChecks()} />;
}
