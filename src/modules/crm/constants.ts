import type { Tone } from "@/components/ui";

// مراحل البيع ومصادر العملاء مطابقة لقاعدة «العملاء المحتملون (CRM)» في Notion.
export const STAGES = {
  new: { label: "جديد", tone: "neutral" as Tone, open: true },
  contacted: { label: "تم التواصل", tone: "info" as Tone, open: true },
  qualified: { label: "مؤهل", tone: "warning" as Tone, open: true },
  meeting: { label: "اجتماع", tone: "warning" as Tone, open: true },
  proposal: { label: "عرض مرسل", tone: "primary" as Tone, open: true },
  negotiation: { label: "تفاوض", tone: "primary" as Tone, open: true },
  won: { label: "فاز", tone: "success" as Tone, open: false },
  lost: { label: "خسر", tone: "danger" as Tone, open: false },
  unfit: { label: "غير مناسب", tone: "neutral" as Tone, open: false },
} as const;
export type Stage = keyof typeof STAGES;
export const STAGE_KEYS = Object.keys(STAGES) as [Stage, ...Stage[]];

export const SOURCES = {
  referral: "إحالة",
  direct: "تواصل مباشر",
  content: "محتوى",
  ad: "إعلان",
  event: "فعالية",
  other: "أخرى",
} as const;
export type Source = keyof typeof SOURCES;
export const SOURCE_KEYS = Object.keys(SOURCES) as [Source, ...Source[]];

export const stageMeta = (stage: string) => STAGES[stage as Stage] ?? STAGES.new;
