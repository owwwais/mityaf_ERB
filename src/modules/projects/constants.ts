import type { Tone } from "@/components/ui";

export const PROJECT_STATUSES = {
  planned: { label: "مخطط", tone: "neutral" as Tone, open: true },
  active: { label: "جارٍ", tone: "info" as Tone, open: true },
  delivered: { label: "مُسلَّم", tone: "primary" as Tone, open: false },
  closed: { label: "مغلق", tone: "success" as Tone, open: false },
  cancelled: { label: "ملغى", tone: "danger" as Tone, open: false },
} as const;
export type ProjectStatus = keyof typeof PROJECT_STATUSES;
export const PROJECT_STATUS_KEYS = Object.keys(PROJECT_STATUSES) as [ProjectStatus, ...ProjectStatus[]];
export const projectStatusMeta = (status: string) => PROJECT_STATUSES[status as ProjectStatus] ?? PROJECT_STATUSES.active;

export const PROJECT_TYPES = { joint: "مشترك", individual: "فردي" } as const;
export const BILLING = { one_time: "مقطوع", monthly: "باقة شهرية" } as const;
