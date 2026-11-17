"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Modal } from "../../../messages/whatsapp/modal";
import { applyOnEnter } from "@/utils/filter-modal-keys";
import {
  applyFilterPatch,
  type SegmentFilters,
} from "@/lib/campaigns/segment-people";
import { EMPTY_AUDIENCE } from "@/types/campaign";
import { AudienceConditions } from "../../_form/audience-step";
import type { FormAction } from "../../_form/form-state";

/**
 * The filters of a segment, in the dialog the other lists of the dashboard use:
 * what is chosen here is applied with the button or with Enter in a field, and
 * Escape closes it. The controls are the audience step's own, so a filter reads
 * and works the same wherever it is chosen.
 */
export function SegmentFilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: SegmentFilters;
  onChange: (next: SegmentFilters) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard.common");

  // The controls speak the campaign form's action shape; only SET_AUDIENCE
  // ever arrives here.
  const dispatch: Dispatch<FormAction> = (action) => {
    if (action.type !== "SET_AUDIENCE") return;
    onChange(applyFilterPatch(pending, action.patch));
  };

  return (
    <Modal title={t("filters")} onClose={onClose}>
      <div
        className="flex flex-col gap-5 overflow-y-auto px-6 py-5"
        onKeyDown={applyOnEnter(onApply)}
      >
        <AudienceConditions
          audience={{ ...EMPTY_AUDIENCE, ...pending }}
          fieldErrors={{}}
          disabled={false}
          dispatch={dispatch}
        />
      </div>
      <div className="border-sand-100 flex shrink-0 items-center justify-between border-t px-6 py-4">
        <button
          type="button"
          onClick={onClear}
          className="text-petroleum-400 hover:text-petroleum-700 min-h-11 text-sm transition-colors"
        >
          {t("clearAll")}
        </button>
        <Button size="md" onClick={onApply}>
          {t("applyFilters")}
        </Button>
      </div>
    </Modal>
  );
}
