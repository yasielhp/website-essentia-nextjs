"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import {
  type DashboardLocation,
  type LocationAddress,
  type LocationOption,
} from "../_shared/location-options";
import { LocationSelect } from "../_shared/location";
import type { FormAction } from "./form-state";
import { CompletedRow } from "./completed-row";
import { HomeAddressFields, RoomFields } from "./location-fields";

/**
 * Where the session happens, and the address it needs.
 *
 * The centre and a hotel room both want a reservation and a room number; a home
 * visit wants a street address. Which of the three is on show is the only thing
 * this component decides — the fields themselves are next door.
 */
export function LocationStep({
  location,
  address,
  reservationNumber,
  roomNumber,
  allowedLocations,
  locationLabel,
  submitting,
  editing,
  onEdit,
  onDone,
  dispatchForm,
}: {
  location: DashboardLocation | "";
  address: LocationAddress;
  reservationNumber: string;
  roomNumber: string;
  allowedLocations: LocationOption[];
  /** The chosen place in words, for the one-line summary. */
  locationLabel: string;
  submitting: boolean;
  /** True while this step is the one being answered. */
  editing: boolean;
  onEdit: () => void;
  /** Called when the address is complete and the step can close. */
  onDone: () => void;
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");

  if (location && !editing) {
    return (
      <CompletedRow
        label={t("steps.location")}
        value={locationLabel}
        onEdit={onEdit}
      />
    );
  }

  const roomFields = (idPrefix: string) => (
    <RoomFields
      idPrefix={idPrefix}
      reservationNumber={reservationNumber}
      roomNumber={roomNumber}
      submitting={submitting}
      onDone={onDone}
      dispatchForm={dispatchForm}
    />
  );

  return (
    <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.location")}
      </h2>
      <div className="flex flex-col gap-4">
        <LocationSelect
          selected={location || null}
          onSelect={(l) => {
            dispatchForm({ type: "SET_LOCATION", value: l });
            onEdit();
          }}
          locations={allowedLocations}
        />

        {location === "centro" && roomFields("centro-")}
        {location === "habitacion" && roomFields("")}
        {location === "domicilio" && (
          <HomeAddressFields
            address={address}
            submitting={submitting}
            onDone={onDone}
            dispatchForm={dispatchForm}
          />
        )}
      </div>
    </div>
  );
}
