"use client";

import { useTranslations } from "next-intl";
import { Building2, Home, BedDouble } from "lucide-react";
import { contact } from "@/constants/contact";

/**
 * Where a booking takes place, and how somebody picks it.
 *
 * The new-booking screen and the edit screen asked the same question with the
 * same three answers, the same municipality list and the same dropdown — twice,
 * character for character, in two files of two thousand lines each. One of the
 * copies had already drifted a Tailwind class.
 */
export type DashboardLocation = "centro" | "habitacion" | "domicilio";

export type LocationAddress = {
  street: string;
  building: string;
  postalCode: string;
  municipality: string;
};

export const TENERIFE_MUNICIPALITIES = [
  "Adeje",
  "Arona",
  "Granadilla de Abona",
  "Guía de Isora",
  "San Miguel de Abona",
  "Santiago del Teide",
  "Los Cristianos",
  "Playa de las Américas",
  "Costa Adeje",
  "El Médano",
  "Los Abrigos",
  "Puerto de la Cruz",
  "Santa Cruz de Tenerife",
  "San Cristóbal de La Laguna",
  "Los Realejos",
  "Candelaria",
  "Güímar",
];

export type LocationOption = {
  id: DashboardLocation;
  label: string;
  description: string;
  Icon: React.FC<{ size?: number; className?: string }>;
};

const LOCATION_ICONS: Record<
  DashboardLocation,
  React.FC<{ size?: number; className?: string }>
> = {
  centro: Building2,
  habitacion: BedDouble,
  domicilio: Home,
};

export /**
 * The wording comes from `dashboard.bookings.form.locations`; only the centre's
 * description is a real-world address, so it keeps coming from `contact`.
 */
function useLocationOptions(): LocationOption[] {
  const t = useTranslations("dashboard.bookings.form.locations");
  return [
    {
      id: "centro",
      label: t("centro.label"),
      description: contact.address,
      Icon: LOCATION_ICONS.centro,
    },
    {
      id: "habitacion",
      label: t("habitacion.label"),
      description: t("habitacion.description"),
      Icon: LOCATION_ICONS.habitacion,
    },
    {
      id: "domicilio",
      label: t("domicilio.label"),
      description: t("domicilio.description"),
      Icon: LOCATION_ICONS.domicilio,
    },
  ];
}

export const EMPTY_ADDRESS: LocationAddress = {
  street: "",
  building: "",
  postalCode: "",
  municipality: "",
};
