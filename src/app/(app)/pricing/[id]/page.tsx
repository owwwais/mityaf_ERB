import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getBuilderProps } from "@/modules/pricing/builder-props";
import { QuoteBuilder, type QuoteDraft } from "@/modules/pricing/components/quote-builder";
import { getQuote } from "@/modules/pricing/queries";

export const metadata: Metadata = { title: "عرض سعر" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, { blank, ...props }] = await Promise.all([getQuote(id), getBuilderProps()]);
  if (!row) notFound();
  const { quote } = row;

  const initial: QuoteDraft = {
    title: quote.title,
    clientId: quote.clientId,
    serviceId: quote.serviceId,
    validUntil: quote.validUntil,
    scopeIncluded: quote.scopeIncluded,
    scopeExcluded: quote.scopeExcluded,
    notes: quote.notes,
    inputs: { ...blank.inputs, ...quote.inputs, items: quote.inputs.items.length ? quote.inputs.items : blank.inputs.items },
  };

  return (
    <>
      <Link href="/pricing" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ChevronRight size={15} /> التسعير
      </Link>
      <PageHeader title={quote.title} description={row.clientName ?? undefined} />
      {/* key: إعادة تهيئة الحاسبة عند تغيّر الحالة أو الحفظ من الخادم */}
      <QuoteBuilder key={`${quote.id}-${quote.status}`} quoteId={quote.id} number={quote.number} status={quote.status} projectId={row.projectId} initial={initial} {...props} />
    </>
  );
}
