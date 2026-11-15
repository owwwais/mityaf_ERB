import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partners, settings, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ensureDefaults } from "./defaults";

export const getSettings = cache(async () => {
  await requireUser();
  const db = await getDb();
  let [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (!row) {
    await ensureDefaults(db);
    [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  }
  return row;
});

export const listPartners = cache(async (opts: { includeInactive?: boolean } = {}) => {
  await requireUser();
  const db = await getDb();
  const rows = await db.select().from(partners).orderBy(asc(partners.sort), asc(partners.createdAt));
  return opts.includeInactive ? rows : rows.filter((p) => p.active);
});

export async function listUsers() {
  await requireUser();
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, partnerId: users.partnerId })
    .from(users)
    .orderBy(asc(users.createdAt));
}

export const partnerOptions = (rows: { id: string; name: string }[]) => rows.map((p) => ({ value: p.id, label: p.name }));
