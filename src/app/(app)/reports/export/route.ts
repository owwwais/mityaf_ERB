import { requireUser } from "@/lib/auth";
import { METHODS, PAYMENT_KINDS, TREASURY_LABEL, type Method, type PaymentKind } from "@/modules/finance/constants";
import { listPayments } from "@/modules/finance/queries";
import { getDb } from "@/db";
import { expenseCategories, expenses, partners, projects } from "@/db/schema";
import { and, asc, eq, gte, lt } from "drizzle-orm";

/** خلية CSV آمنة: تُقتبس، ولا تُفسَّر كصيغة في جداول البيانات. */
function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

const toCsv = (rows: (string | number | null | undefined)[][]) => `﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "payments" ? "payments" : "expenses";
  const yearParam = url.searchParams.get("year") ?? "";
  const year = /^\d{4}$/.test(yearParam) ? Number(yearParam) : new Date().getUTCFullYear();
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;

  let csv: string;
  if (type === "payments") {
    const rows = await listPayments({ from, to }, 10_000);
    csv = toCsv([
      ["التاريخ", "المبلغ", "المشروع", "العميل", "النوع", "استلمها", "طريقة الدفع", "ملاحظات"],
      ...rows.map((p) => [
        p.date,
        p.amount,
        p.projectName ?? "إيراد عام",
        p.clientName,
        PAYMENT_KINDS[p.kind as PaymentKind] ?? p.kind,
        p.receivedByName ?? TREASURY_LABEL,
        METHODS[p.method as Method] ?? p.method,
        p.notes,
      ]),
    ]);
  } else {
    const db = await getDb();
    const rows = await db
      .select({
        date: expenses.date,
        amount: expenses.amount,
        description: expenses.description,
        vendor: expenses.vendor,
        method: expenses.method,
        notes: expenses.notes,
        category: expenseCategories.name,
        project: projects.name,
        paidBy: partners.name,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .leftJoin(partners, eq(expenses.paidBy, partners.id))
      .where(and(gte(expenses.date, from), lt(expenses.date, to)))
      .orderBy(asc(expenses.date));
    csv = toCsv([
      ["التاريخ", "المبلغ", "الوصف", "الفئة", "المشروع", "دُفع من", "المورّد", "طريقة الدفع", "ملاحظات"],
      ...rows.map((e) => [
        e.date,
        e.amount,
        e.description,
        e.category,
        e.project ?? "تشغيلي عام",
        e.paidBy ?? TREASURY_LABEL,
        e.vendor,
        METHODS[e.method as Method] ?? e.method,
        e.notes,
      ]),
    ]);
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mityaf-${type}-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
