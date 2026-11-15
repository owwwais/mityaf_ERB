import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import {
  clients,
  expenseCategories,
  expenses,
  operatingCosts,
  partners,
  payments,
  projects,
  quotes,
  services,
  settings,
  timeLogs,
} from "@/db/schema";
import { addDays, currentMonth, shiftMonth, todayISO } from "@/lib/format";
import { annualize } from "../finance/constants";
import { computeQuote, type QuoteInput } from "../pricing/engine";
import { costModelFrom, rulesFrom } from "../pricing/model";

/**
 * بيانات تجريبية وهمية بالكامل (عملاء ومشاريع ومصروفات) لاستكشاف النظام.
 * تُحذف من الإعدادات ← تصفير البيانات.
 */
export async function seedDemo(db: DB): Promise<void> {
  const today = todayISO();
  const month = currentMonth();
  const todayDay = Number(today.slice(8));
  /** تاريخ في شهر نسبي، لا يتجاوز اليوم. */
  const on = (monthOffset: number, day: number) => {
    const d = monthOffset === 0 ? Math.min(day, todayDay) : Math.min(day, 28);
    return `${shiftMonth(month, monthOffset)}-${String(d).padStart(2, "0")}`;
  };

  const [config] = await db.select().from(settings).where(eq(settings.id, 1));
  const partnerRows = await db.select().from(partners).orderBy(asc(partners.sort));
  const [tech, biz] = partnerRows;
  if (!config || !tech || !biz) return;

  const categories = await db.select().from(expenseCategories);
  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const serviceRows = await db.select().from(services);
  const svc = (name: string) => serviceRows.find((s) => s.name === name)?.id ?? null;

  // ── التكاليف المتكررة ──
  const costSeeds = [
    { name: "استضافة المنصات (خوادم سحابية)", category: "استضافة وخوادم", amount: 180, cycle: "monthly" as const, paidBy: tech.id },
    { name: "اشتراكات نماذج الذكاء الاصطناعي", category: "ذكاء اصطناعي ونماذج", amount: 300, cycle: "monthly" as const, paidBy: tech.id },
    { name: "أدوات التطوير والمستودعات", category: "أدوات واشتراكات برمجية", amount: 95, cycle: "monthly" as const, paidBy: tech.id },
    { name: "بريد ومساحة عمل", category: "أدوات واشتراكات برمجية", amount: 45, cycle: "monthly" as const, paidBy: biz.id },
    { name: "حضور رقمي ومحتوى", category: "تسويق وإعلان", amount: 150, cycle: "monthly" as const, paidBy: biz.id },
    { name: "نطاقات الشركة والمنتجات", category: "نطاقات", amount: 320, cycle: "yearly" as const, paidBy: tech.id },
  ];
  const costRows = await db
    .insert(operatingCosts)
    .values(costSeeds.map((c) => ({ name: c.name, categoryId: cat(c.category), amount: c.amount, cycle: c.cycle })))
    .returning();

  const annualOperatingCost = costSeeds.reduce((s, c) => s + annualize(c.amount, c.cycle), 0);
  const model = costModelFrom(config, partnerRows, annualOperatingCost);
  const rules = rulesFrom(config, partnerRows);

  // ── العملاء ──
  const clientRows = await db
    .insert(clients)
    .values([
      { name: "مؤسسة الواحة العقارية", contactName: "مدير الأملاك", sector: "عقار", source: "referral", stage: "won", expectedValue: 9000, interest: "منصة إدارة الوحدات" },
      { name: "مكتب أفق للاستشارات", contactName: "المدير التنفيذي", sector: "استشارات", source: "direct", stage: "won", expectedValue: 3500, interest: "موقع تعريفي" },
      { name: "عيادات لمسة", contactName: "مديرة التشغيل", sector: "صحة", source: "referral", stage: "won", expectedValue: 2000, interest: "ميعاد + شريك تقني" },
      {
        name: "متجر زاد للمواد الغذائية",
        contactName: "المالك",
        sector: "تجزئة",
        source: "content",
        stage: "proposal",
        expectedValue: 8000,
        interest: "نظام ولاء ونقاط بيع",
        need: "برنامج ولاء بسيط لثلاثة فروع بلا تكلفة الأنظمة الكبيرة.",
        nextStep: "متابعة العرض المرسل",
        followUpDate: addDays(today, 3),
      },
      {
        name: "مقهى ركن",
        contactName: "الشريك المدير",
        sector: "مطاعم ومقاهٍ",
        source: "event",
        stage: "meeting",
        expectedValue: 2500,
        interest: "تطبيق طلبات",
        nextStep: "تحديد موعد عرض تجريبي",
        followUpDate: addDays(today, -2),
      },
      { name: "شركة مسار اللوجستية", sector: "نقل", source: "other", stage: "new", interest: "لوحة معلومات تشغيلية" },
    ])
    .returning();
  const client = (name: string) => clientRows.find((c) => c.name === name)!.id;

  // ── العروض ──
  const base: QuoteInput = {
    billing: "one_time",
    projectType: "joint",
    finderId: null,
    executorId: null,
    items: [],
    directCosts: [],
    riskPct: config.defaultRiskPct,
    marginPct: config.targetMarginPct,
    urgencyPct: 0,
    loadPct: 0,
    discountPct: 0,
    productValue: 0,
    downPaymentPct: config.downPaymentPct,
    manualPrice: null,
  };

  const quoteSeeds: {
    title: string;
    client: string;
    service: string;
    status: "draft" | "sent" | "accepted";
    createdOn: string;
    scopeIncluded: string;
    scopeExcluded: string;
    inputs: QuoteInput;
  }[] = [
    {
      title: "تخصيص منصة إدارة الوحدات — الواحة العقارية",
      client: "مؤسسة الواحة العقارية",
      service: "منصة إدارة الوحدات والعقارات",
      status: "accepted",
      createdOn: on(-2, 4),
      scopeIncluded: "تهيئة المنصة بهوية المؤسسة، ترحيل بيانات 120 وحدة، صفحة عرض عامة، تدريب فريق الأملاك.",
      scopeExcluded: "تطبيق جوال مستقل، الربط مع أنظمة محاسبية خارجية.",
      inputs: {
        ...base,
        productValue: 1500,
        items: [
          { title: "تحليل المتطلبات وطريقة العمل الحالية", hours: 4, partnerId: biz.id },
          { title: "تخصيص الواجهة والهوية", hours: 8, partnerId: tech.id },
          { title: "ترحيل بيانات الوحدات والعقود", hours: 6, partnerId: tech.id },
          { title: "اختبار وضبط الصلاحيات", hours: 4, partnerId: tech.id },
          { title: "تدريب وتسليم", hours: 4, partnerId: biz.id },
        ],
        directCosts: [{ title: "استضافة السنة الأولى", amount: 240 }],
      },
    },
    {
      title: "موقع تعريفي — مكتب أفق للاستشارات",
      client: "مكتب أفق للاستشارات",
      service: "مواقع وصفحات الويب",
      status: "accepted",
      createdOn: on(-3, 6),
      scopeIncluded: "خمس صفحات متجاوبة، نموذج تواصل، ربط النطاق.",
      scopeExcluded: "كتابة المحتوى، التصوير، لوحة تحكم مخصصة.",
      inputs: {
        ...base,
        projectType: "individual",
        finderId: biz.id,
        executorId: tech.id,
        riskPct: 10,
        discountPct: 15,
        items: [
          { title: "تصميم الواجهة", hours: 5, partnerId: tech.id },
          { title: "التطوير", hours: 7, partnerId: tech.id },
          { title: "رفع المحتوى والنشر", hours: 2, partnerId: tech.id },
        ],
        directCosts: [{ title: "خطوط وأيقونات مرخّصة", amount: 120 }],
      },
    },
    {
      title: "باقة الشريك التقني — عيادات لمسة",
      client: "عيادات لمسة",
      service: "الشريك التقني (باقة شهرية)",
      status: "accepted",
      createdOn: on(-1, 2),
      scopeIncluded: "متابعة تشغيل منصة المواعيد، معالجة الأعطال، تقرير شهري.",
      scopeExcluded: "تطوير ميزات جديدة (تُسعَّر مستقلة).",
      inputs: {
        ...base,
        billing: "monthly",
        riskPct: 10,
        downPaymentPct: 100,
        items: [
          { title: "صيانة ومتابعة التشغيل", hours: 4, partnerId: tech.id },
          { title: "دعم المستخدمين", hours: 2, partnerId: tech.id },
          { title: "تقرير شهري ومراجعة", hours: 1, partnerId: biz.id },
        ],
        directCosts: [{ title: "استضافة ورسائل تذكير", amount: 60 }],
      },
    },
    {
      title: "نظام ولاء ونقاط بيع — متجر زاد",
      client: "متجر زاد للمواد الغذائية",
      service: "أنظمة وحلول رقمية مخصصة",
      status: "sent",
      createdOn: addDays(today, -4),
      scopeIncluded: "بطاقات ولاء رقمية، لوحة للفروع الثلاثة، تقارير أسبوعية.",
      scopeExcluded: "أجهزة نقاط البيع، الربط مع المخزون.",
      inputs: {
        ...base,
        riskPct: 20,
        items: [
          { title: "تحليل ونطاق", hours: 5, partnerId: biz.id },
          { title: "بناء نظام النقاط والبطاقات", hours: 16, partnerId: tech.id },
          { title: "لوحة الفروع والتقارير", hours: 8, partnerId: tech.id },
          { title: "تجربة مغلقة وتدريب", hours: 4, partnerId: biz.id },
        ],
        directCosts: [{ title: "خدمة بطاقات المحفظة", amount: 350 }],
      },
    },
    {
      title: "تطبيق طلبات — مقهى ركن",
      client: "مقهى ركن",
      service: "تطبيقات الهاتف",
      status: "draft",
      createdOn: addDays(today, -1),
      scopeIncluded: "",
      scopeExcluded: "",
      inputs: {
        ...base,
        riskPct: 35,
        items: [
          { title: "تصميم رحلة الطلب", hours: 6, partnerId: biz.id },
          { title: "تطوير التطبيق", hours: 20, partnerId: tech.id },
        ],
      },
    },
  ];

  const year = today.slice(0, 4);
  const savedQuotes = [];
  for (const [i, q] of quoteSeeds.entries()) {
    const result = computeQuote(q.inputs, model, rules);
    const [row] = await db
      .insert(quotes)
      .values({
        number: `Q-${year}-${String(i + 1).padStart(3, "0")}`,
        title: q.title,
        clientId: client(q.client),
        serviceId: svc(q.service),
        status: q.status,
        inputs: q.inputs,
        result,
        price: result.finalPrice,
        totalHours: result.baseHours,
        totalCost: result.totalCost,
        marginPct: result.marginPct,
        validUntil: addDays(q.createdOn, config.quoteValidityDays),
        scopeIncluded: q.scopeIncluded,
        scopeExcluded: q.scopeExcluded,
        createdAt: new Date(`${q.createdOn}T09:00:00Z`),
      })
      .returning();
    savedQuotes.push(row);
  }
  const [qUnits, qSite, qCare] = savedQuotes;

  // ── المشاريع ──
  const [pUnits, pSite, pCare] = await db
    .insert(projects)
    .values([
      {
        name: qUnits.title,
        clientId: qUnits.clientId,
        quoteId: qUnits.id,
        type: "joint",
        status: "active",
        price: qUnits.price,
        estimatedHours: qUnits.totalHours,
        startDate: on(-2, 8),
        dueDate: addDays(today, 12),
      },
      {
        name: qSite.title,
        clientId: qSite.clientId,
        quoteId: qSite.id,
        type: "individual",
        finderId: biz.id,
        executorId: tech.id,
        status: "delivered",
        price: qSite.price,
        estimatedHours: qSite.totalHours,
        startDate: on(-3, 10),
        dueDate: on(-2, 6),
      },
      {
        name: qCare.title,
        clientId: qCare.clientId,
        quoteId: qCare.id,
        type: "joint",
        billing: "monthly",
        status: "active",
        price: qCare.price,
        estimatedHours: qCare.totalHours,
        startDate: on(-1, 3),
      },
    ])
    .returning();

  // ── الساعات ──
  await db.insert(timeLogs).values([
    { projectId: pSite.id, partnerId: tech.id, date: on(-3, 12), hours: 6, note: "تصميم الواجهة" },
    { projectId: pSite.id, partnerId: tech.id, date: on(-3, 20), hours: 8, note: "التطوير" },
    { projectId: pSite.id, partnerId: tech.id, date: on(-2, 3), hours: 4.5, note: "تعديلات إضافية طلبها العميل" },
    { projectId: pUnits.id, partnerId: biz.id, date: on(-2, 9), hours: 4, note: "ورشة المتطلبات" },
    { projectId: pUnits.id, partnerId: tech.id, date: on(-2, 18), hours: 7, note: "تخصيص الواجهة" },
    { projectId: pUnits.id, partnerId: tech.id, date: on(-1, 7), hours: 6, note: "ترحيل البيانات" },
    { projectId: pUnits.id, partnerId: tech.id, date: on(0, 5), hours: 3, note: "اختبار الصلاحيات" },
    { projectId: pCare.id, partnerId: tech.id, date: on(-1, 15), hours: 5, note: "متابعة الشهر الأول" },
    { projectId: pCare.id, partnerId: biz.id, date: on(-1, 27), hours: 1, note: "التقرير الشهري" },
    { projectId: pCare.id, partnerId: tech.id, date: on(0, 8), hours: 3, note: "صيانة ودعم" },
  ]);

  // ── المقبوضات ──
  const half = (n: number) => Math.round(n / 2);
  await db.insert(payments).values([
    { date: on(-3, 9), amount: half(pSite.price), projectId: pSite.id, clientId: pSite.clientId, kind: "down_payment", receivedBy: biz.id },
    { date: on(-2, 7), amount: pSite.price - half(pSite.price), projectId: pSite.id, clientId: pSite.clientId, kind: "final", receivedBy: tech.id },
    { date: on(-2, 8), amount: half(pUnits.price), projectId: pUnits.id, clientId: pUnits.clientId, kind: "down_payment", receivedBy: biz.id },
    { date: on(-1, 3), amount: pCare.price, projectId: pCare.id, clientId: pCare.clientId, kind: "subscription", receivedBy: biz.id },
    { date: on(0, 3), amount: pCare.price, projectId: pCare.id, clientId: pCare.clientId, kind: "subscription", receivedBy: biz.id },
  ]);

  // ── المصروفات ──
  const expenseValues: (typeof expenses.$inferInsert)[] = [];
  for (const offset of [-3, -2, -1, 0]) {
    for (const [i, seed] of costSeeds.entries()) {
      if (seed.cycle === "yearly") {
        if (offset !== -3) continue;
      } else if (offset === 0 && i > 1) {
        continue; // هذا الشهر: بندان فقط سُجّلا، والباقي ينتظر زر «تسجيل»
      }
      expenseValues.push({
        date: on(offset, 2 + i * 3),
        amount: seed.amount,
        description: seed.name,
        categoryId: cat(seed.category),
        paidBy: seed.paidBy,
        operatingCostId: costRows[i].id,
        method: "card",
      });
    }
  }
  expenseValues.push(
    { date: on(-3, 14), amount: 120, description: "خطوط وأيقونات مرخّصة", categoryId: cat("أدوات واشتراكات برمجية"), projectId: pSite.id, paidBy: tech.id, method: "card" },
    { date: on(-2, 10), amount: 240, description: "استضافة السنة الأولى للمنصة", vendor: "مزوّد الاستضافة", categoryId: cat("استضافة وخوادم"), projectId: pUnits.id, paidBy: tech.id, method: "card" },
    { date: on(-2, 16), amount: 600, description: "تصميم هوية بصرية أولية", vendor: "مصمم مستقل", categoryId: cat("مستقلون ومتعاونون"), paidBy: biz.id, method: "transfer" },
    { date: on(-1, 12), amount: 220, description: "حملة ممولة للتعريف بالخدمات", categoryId: cat("تسويق وإعلان"), paidBy: biz.id, method: "card" },
    { date: on(-1, 20), amount: 60, description: "استضافة ورسائل تذكير", categoryId: cat("استضافة وخوادم"), projectId: pCare.id, paidBy: tech.id, method: "card" },
    { date: on(0, 6), amount: 85, description: "ضيافة اجتماع عميل", categoryId: cat("مواصلات وضيافة"), paidBy: biz.id, method: "cash" },
    { date: on(0, 9), amount: 60, description: "استضافة ورسائل تذكير", categoryId: cat("استضافة وخوادم"), projectId: pCare.id, paidBy: tech.id, method: "card" },
  );
  await db.insert(expenses).values(expenseValues);
}
