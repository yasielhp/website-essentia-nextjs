"use client";

import type { PlanRow } from "@/types/settings";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { formatPrice } from "@/utils/format";

/**
 * One membership plan: a tile with its initial in place of a picture (plans
 * have none), its name, its monthly price, and the way into the editor — the
 * same row the session types and the bonus plans use.
 */
function PlanRowItem({ plan, onEdit }: { plan: PlanRow; onEdit: () => void }) {
  const t = useTranslations("dashboard.settings.plans");
  const locale = useDashboardLocale();
  return (
    <div className="border-sand-200 flex items-center gap-4 rounded-2xl border bg-white p-3">
      <div
        aria-hidden="true"
        className="bg-petroleum-50 text-petroleum-700 font-display flex size-16 shrink-0 items-center justify-center rounded-xl text-2xl uppercase"
      >
        {plan.label.trim().charAt(0) || "—"}
      </div>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-petroleum-700 truncate text-sm font-medium capitalize">
          {plan.label}
        </span>
        <span className="text-petroleum-400 truncate text-xs">
          {plan.price_monthly != null
            ? `${formatPrice(plan.price_monthly, locale)} ${t("perMonth")}`
            : t("noPrice")}
        </span>
      </span>
      <Button variant="solid" size="md" onClick={onEdit}>
        {t("edit")}
      </Button>
    </div>
  );
}

export function PlansTabContent({
  plans,
  onEdit,
}: {
  plans: PlanRow[];
  onEdit: (plan: PlanRow) => void;
}) {
  const t = useTranslations("dashboard.settings.plans");
  return (
    <div>
      {/* Row height matches the other settings headers, so all of them sit
          the same distance under the tabs. */}
      <div className="mb-4 flex h-10 items-center">
        <h2 className="font-display text-petroleum-700 text-xl">
          {t("heading")}
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <PlanRowItem key={plan.id} plan={plan} onEdit={() => onEdit(plan)} />
        ))}
      </div>
    </div>
  );
}
