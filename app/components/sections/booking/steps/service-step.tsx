"use client";

import { useTranslations } from "next-intl";
import { bookableServices, type BookableService } from "@/data/services-data";
import {
  ServicePicker,
  type ServicePickerOption,
} from "@/components/ui/service-picker";

/**
 * The public step wraps the shared picker with translated copy.
 *
 * Titles and descriptions come from the `booking.serviceStep` namespace rather
 * than from `bookableServices`, whose English strings are what the dashboard
 * shows. The picker itself is presentation only, so each surface keeps its own
 * source of words.
 */
export function ServiceStep({
  selected,
  onSelect,
}: {
  selected: BookableService | null;
  onSelect: (s: BookableService | null) => void;
}) {
  const t = useTranslations("booking.serviceStep");

  const options: ServicePickerOption[] = bookableServices.map((s) => ({
    id: s.id,
    title: t(`services.${s.id}.title`),
    description: t(`services.${s.id}.description`),
    category: s.category,
    image: s.image,
  }));

  const labels = {
    placeholder: t("placeholder"),
    modalTitle: t("modalTitle"),
    close: t("close"),
    wellness: t("wellness"),
    medicine: t("medicine"),
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">{t("label")}</p>
      <ServicePicker
        options={options}
        selected={options.find((o) => o.id === selected?.id) ?? null}
        onSelect={(option) =>
          onSelect(bookableServices.find((s) => s.id === option.id) ?? null)
        }
        labels={labels}
      />
    </div>
  );
}
