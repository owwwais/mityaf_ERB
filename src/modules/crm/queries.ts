import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function listClients() {
  await requireUser();
  const db = await getDb();
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function clientOptions() {
  await requireUser();
  const db = await getDb();
  const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name));
  return rows.map((c) => ({ value: c.id, label: c.name }));
}

export async function getClient(id: string) {
  await requireUser();
  const db = await getDb();
  const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return row ?? null;
}
