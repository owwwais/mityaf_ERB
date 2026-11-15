import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { listPartners, partnerOptions } from "../core/queries";
import { clientOptions } from "../crm/queries";
import { projectOptions } from "../projects/queries";
import type { FormLookups } from "./components/forms";
import { listCategories } from "./queries";

/** القوائم المنسدلة التي تحتاجها نماذج المصروف والدفعة. */
export async function getFormLookups(opts: { withClients?: boolean } = {}): Promise<FormLookups> {
  const user = await requireUser();
  const [categories, projects, partners, clients] = await Promise.all([
    listCategories(),
    projectOptions(),
    listPartners(),
    opts.withClients ? clientOptions() : undefined,
  ]);
  return {
    categories: categories.map((c) => ({ value: c.id, label: c.name })),
    projects,
    partners: partnerOptions(partners),
    clients,
    myPartnerId: user.partnerId,
    today: todayISO(),
  };
}
