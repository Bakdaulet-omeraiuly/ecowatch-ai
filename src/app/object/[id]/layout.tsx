import type { Metadata } from "next";
import { FACILITIES } from "@/data/facilities";
import { pageMeta } from "@/lib/seo";

// Әр кәсіпорынның жеке беті — атауы тізілімнен алынады, сондықтан
// іздеу нәтижесінде «АМӨЗ — объект картасы» деп нақты шығады.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const fac = FACILITIES.find((f) => f.id === id);
  const name = fac?.name ?? "Объект";
  return pageMeta({
    title: `${name} — объект картасы`,
    description:
      `${name} нысанының экологиялық кескіні: нүктедегі ауа сапасы, ҚР ` +
      "нормаларымен салыстыру, дәлелдер тізбегі және спутник суреттерінің " +
      "уақыт шкаласы.",
    path: `/object/${id}`,
    keywords: fac ? [fac.name, fac.short] : [],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
