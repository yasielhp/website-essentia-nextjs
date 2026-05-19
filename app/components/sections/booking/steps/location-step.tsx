"use client";

import { Building2, BedDouble, Home } from "lucide-react";

const LOCATIONS = [
  {
    id: "centro",
    label: "En el centro",
    description: "Visítanos en nuestras instalaciones",
    Icon: Building2,
  },
  {
    id: "habitacion",
    label: "Habitación",
    description: "Servicio en tu habitación del hotel",
    Icon: BedDouble,
  },
  {
    id: "domicilio",
    label: "Fuera del centro (a domicilio)",
    description: "Nos desplazamos hasta tu domicilio",
    Icon: Home,
  },
] as const;

export type BookingLocation = (typeof LOCATIONS)[number]["id"];

export function LocationStep({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (location: BookingLocation) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">
        ¿Dónde deseas recibir el servicio?
      </p>
      <div className="flex flex-col gap-3">
        {LOCATIONS.map(({ id, label, description, Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={[
              "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
              selected === id
                ? "border-petroleum-400 bg-petroleum-50 ring-petroleum-100 ring-2"
                : "border-sand-300 bg-sand-50 hover:border-petroleum-400",
            ].join(" ")}
          >
            <div
              className={[
                "flex size-12 shrink-0 items-center justify-center rounded-xl",
                selected === id ? "bg-petroleum-100" : "bg-sand-200",
              ].join(" ")}
            >
              <Icon
                size={22}
                className={
                  selected === id ? "text-petroleum-700" : "text-petroleum-400"
                }
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-petroleum-700 text-sm font-medium">{label}</p>
              <p className="text-petroleum-400 text-xs">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
