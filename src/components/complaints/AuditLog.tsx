"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { authHeaders } from "@/lib/authClient";
import { useLang } from "@/lib/i18n";

type Entry = {
  id: number; at: string; actor: string | null; actor_role: string | null;
  target_table: string; target_id: string; action: "update" | "delete";
  changes: Record<string, { from: unknown; to: unknown }>;
};

const show = (v: unknown) => (v === null || v === undefined ? "—" : String(v));

// P3.8: officer/admin view of the append-only action log written by a DB trigger.
export function AuditLog() {
  const { tr, lang } = useLang();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [version, setVersion] = useState(0);
  const load = () => { setLoading(true); setError(null); setVersion((v) => v + 1); };

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/officer/audit",
          { headers: await authHeaders(), cache: "no-store", signal: controller.signal });
        const body = await res.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!res.ok) { setEntries(null); setError(body?.error ?? String(res.status)); }
        else setEntries(body.entries);
      } catch {
        if (controller.signal.aborted) return;
        setEntries(null); setError(tr("Желі қатесі"));
      }
      setLoading(false);
    })();
    return () => controller.abort();
  }, [tr, version]);

  return (
    <Panel className="mx-auto mt-6 max-w-5xl">
      <PanelHeader
        title={tr("Әрекеттер журналы")}
        description={tr("Әр мәртебе өзгерісі мен жоюды дерекқордың өзі жазады; жазбаны ешкім өзгерте не өшіре алмайды.")}
        actions={<Button variant="outline" className="min-h-[44px]" disabled={loading} onClick={load}>{tr("Жаңарту")}</Button>}
      />
      <div className="overflow-x-auto p-4">
        {loading ? <p role="status">{tr("Жүктелуде…")}</p>
          : error ? <p role="alert" className="text-sm text-red-800">{error}</p>
          : !entries?.length ? <p className="text-sm text-neutral-700">{tr("Журналда әзірге жазба жоқ.")}</p>
          : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-neutral-300 text-neutral-700">
                <tr>
                  <th className="py-2 pr-3">{tr("Уақыты")}</th><th className="py-2 pr-3">{tr("Кім")}</th>
                  <th className="py-2 pr-3">{tr("Нысан")}</th><th className="py-2 pr-3">{tr("Әрекет")}</th>
                  <th className="py-2">{tr("Өзгеріс")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-neutral-200 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(e.at).toLocaleString(lang === "ru" ? "ru-RU" : "kk-KZ")}</td>
                    <td className="py-2 pr-3"><span className="font-mono text-xs">{e.actor?.slice(0, 8) ?? "SQL"}</span> {e.actor_role && <span className="text-neutral-600">({e.actor_role})</span>}</td>
                    <td className="py-2 pr-3">{e.target_table} <span className="font-mono text-xs text-neutral-600">{e.target_id.slice(0, 8)}</span></td>
                    <td className="py-2 pr-3">{e.action === "delete" ? tr("жойылды") : tr("өзгертілді")}</td>
                    <td className="py-2">{Object.entries(e.changes).map(([k, v]) => <div key={k}>{k}: {show(v.from)} → {show(v.to)}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </Panel>
  );
}
