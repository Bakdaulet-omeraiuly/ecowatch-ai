import { haversineKm } from "@/lib/pollutionSource";

export const COMPLAINT_CATEGORIES = ["smell", "smoke", "dust", "fire", "water", "soil"] as const;
export type ComplaintCategory = typeof COMPLAINT_CATEGORIES[number];
export const COMPLAINT_STATUSES = ["submitted", "in_review", "confirmed", "not_confirmed", "resolved"] as const;
export type ComplaintStatus = typeof COMPLAINT_STATUSES[number];

export const STATUS_TRANSITIONS: Record<ComplaintStatus, readonly ComplaintStatus[]> = {
  submitted: ["in_review"],
  in_review: ["confirmed", "not_confirmed"],
  confirmed: ["resolved"],
  not_confirmed: ["in_review"],
  resolved: [],
};
export function canTransition(from: ComplaintStatus, to: ComplaintStatus) {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const DUPLICATE_RADIUS_M = 500;
export const DUPLICATE_WINDOW_MS = 2 * 3600e3;
export const COMPLAINT_RATE_LIMIT = { perHour: 5 } as const;
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
export const MAX_EVENT_AGE_DAYS = 30;
export const PUBLIC_COMPLAINT_FIELDS = "id, category, status, event_at, created_at, lat, lng";

export interface PublicComplaint {
  id: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  event_at: string;
  created_at: string;
  lat: number;
  lng: number;
}

// Build a fresh allowlisted object even when the upstream response has extra fields.
export function toPublicComplaint(row: PublicComplaint): PublicComplaint {
  return {
    id: row.id, category: row.category, status: row.status,
    event_at: row.event_at, created_at: row.created_at,
    lat: Math.round(row.lat * 1000) / 1000,
    lng: Math.round(row.lng * 1000) / 1000,
  };
}

export interface ComplaintGroup {
  id: string;
  category: ComplaintCategory;
  count: number;
  firstAt: string;
  lastAt: string;
  lat: number;
  lng: number;
  members: string[];
}

export function groupComplaints(rows: readonly (PublicComplaint & { flagged?: boolean })[]): ComplaintGroup[] {
  const groups: ComplaintGroup[] = [];
  const ordered = rows.filter((row) => !row.flagged).slice().sort((a, b) =>
    Date.parse(a.event_at) - Date.parse(b.event_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const row of ordered) {
    const group = groups.find((candidate) => candidate.category === row.category
      && Math.abs(Date.parse(row.event_at) - Date.parse(candidate.firstAt)) <= DUPLICATE_WINDOW_MS
      && haversineKm(candidate.lat, candidate.lng, row.lat, row.lng) * 1000 <= DUPLICATE_RADIUS_M);
    if (group) {
      group.count++;
      group.lastAt = row.event_at;
      group.members.push(row.id);
    } else {
      groups.push({
        id: row.id, category: row.category, count: 1,
        firstAt: row.event_at, lastAt: row.event_at, lat: row.lat, lng: row.lng, members: [row.id],
      });
    }
  }
  return groups;
}

export const COMPLAINT_ERRORS = {
  unavailable: "Шағымдар дерекқоры қолжетімсіз — дерек жоқ",
  rateLimit: "Шағым жіберу шегіне жеттіңіз. Бір сағаттан кейін қайталаңыз.",
  badMedia: "Файл пішімі жарамсыз. JPEG, PNG, WebP, MP4 немесе MOV таңдаңыз.",
  tooLarge: "Файл көлемі 4 МБ-тан аспауы керек",
  outsideRegion: "Орын Атырау облысының шегінде болуы керек",
  badEventTime: "Оқиға уақыты соңғы 30 күнде болуы керек және болашақта болмауы тиіс",
  forbiddenTransition: "Мәртебені бұлай өзгертуге болмайды. Деректерді жаңартыңыз.",
  notFound: "Шағым табылмады",
} as const;
