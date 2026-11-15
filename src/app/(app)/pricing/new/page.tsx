import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getBuilderProps } from "@/modules/pricing/builder-props";
import { QuoteBuilder } from "@/modules/pricing/components/quote-builder";

export const metadata: Metadata = { title: "عرض سعر جديد" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [{ client }, { blank, ...props }] = await Promise.all([searchParams, getBuilderProps()]);
  const clientId = props.clients.some((c) => c.value === client) ? client! : null;
  return (
    <>
      <Link href="/pricing" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ChevronRight size={15} /> التسعير
      </Link>
      <PageHeader title="عرض سعر جديد" description="أدخل حجم العمل، والنظام يحسب التكلفة الحقيقية ويقترح السعر ويريك أين يذهب كل ريال." />
      <QuoteBuilder quoteId={null} initial={{ ...blank, clientId }} {...props} />
    </>
  );
}
