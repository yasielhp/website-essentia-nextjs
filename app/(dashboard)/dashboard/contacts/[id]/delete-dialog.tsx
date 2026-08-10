"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function DeleteDialog({
  name,
  deleting,
  onConfirm,
  onCancel,
}: {
  name: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("deleteDialog.title")}
          </h3>
          <p className="text-petroleum-400 text-sm">
            {t.rich("deleteDialog.body", {
              name: () => (
                <strong className="text-petroleum-500 font-medium">
                  {name}
                </strong>
              ),
            })}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            {tCommon("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Section components ───────────────────────────────────────
