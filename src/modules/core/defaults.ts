import { count } from "drizzle-orm";
import type { DB } from "@/db";
import { expenseCategories, services, settings } from "@/db/schema";

/** فئات المصروف الافتراضية لشركة خدمات تقنية صغيرة. */
export const DEFAULT_CATEGORIES = [
  "استضافة وخوادم",
  "نطاقات",
  "أدوات واشتراكات برمجية",
  "ذكاء اصطناعي ونماذج",
  "تسويق وإعلان",
  "مستقلون ومتعاونون",
  "رسوم حكومية وقانونية",
  "بوابات دفع ورسوم بنكية",
  "أجهزة ومعدات",
  "اتصالات وإنترنت",
  "تدريب وتطوير",
  "مواصلات وضيافة",
  "أخرى",
];

type ServiceSeed = { name: string; kind: "service" | "product" | "consulting"; description?: string };

/** كتالوج الخدمات والمنتجات كما في نموذج عمل مطياف. القيم والساعات تُضبط من الإعدادات. */
export const DEFAULT_SERVICES: ServiceSeed[] = [
  { name: "دراسة الجدوى ووثائق المنتج (SAD & PRD)", kind: "service" },
  { name: "مواقع وصفحات الويب", kind: "service", description: "تصميم متجاوب واحترافي." },
  { name: "تطبيقات الهاتف", kind: "service", description: "تصميم وتطوير." },
  { name: "باقة الذكاء الاصطناعي", kind: "service", description: "ربط بالأنظمة، وكلاء أذكياء وأتمتة، تشغيل النماذج محلياً." },
  { name: "أنظمة وحلول رقمية مخصصة", kind: "service" },
  { name: "باقة تجربة العميل ورحلاته", kind: "service" },
  { name: "باقة تحليل وبناء المنافسات", kind: "service", description: "ودعم القطاع الثالث." },
  { name: "تحليل البيانات ولوحات المعلومات", kind: "service" },
  { name: "التقارير التنفيذية والعروض التقديمية", kind: "service" },
  { name: "التحليل التشغيلي وتحسين الإجراءات", kind: "service" },
  { name: "الشريك التقني (باقة شهرية)", kind: "service", description: "دعم ومتابعة تشغيل مستمرة بعد التسليم." },
  { name: "منصة ميعاد", kind: "product", description: "جدولة المواعيد وصفحات الحجز." },
  { name: "منصة إدارة الوحدات والعقارات", kind: "product" },
  { name: "منصة حكيم", kind: "product", description: "التوظيف الذكي وفرز السير الذاتية." },
  { name: "منصة فهيم", kind: "product", description: "إدارة المشاريع التنموية." },
  { name: "منصة تلقينة برو", kind: "product" },
  { name: "موقع تنصيص", kind: "product" },
  { name: "استشارات إدارية وتجربة المستفيد", kind: "consulting" },
  { name: "استشارات تقنية وتنافسية", kind: "consulting" },
];

/** ينشئ صف الإعدادات والفئات والكتالوج إن لم تكن موجودة. آمن للتكرار. */
export async function ensureDefaults(db: DB): Promise<void> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();

  const [cats] = await db.select({ n: count() }).from(expenseCategories);
  if (!cats?.n) {
    await db
      .insert(expenseCategories)
      .values(DEFAULT_CATEGORIES.map((name, sort) => ({ name, sort })))
      .onConflictDoNothing();
  }

  const [svc] = await db.select({ n: count() }).from(services);
  if (!svc?.n) {
    await db.insert(services).values(DEFAULT_SERVICES.map((s, sort) => ({ ...s, description: s.description ?? "", sort })));
  }
}
