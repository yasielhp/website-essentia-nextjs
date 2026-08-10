"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import {
  TENERIFE_MUNICIPALITIES,
  type LocationAddress,
} from "../_shared/location-options";
import type { FormAction } from "./form-state";

/**
 * The address a place needs, once the place is chosen.
 *
 * A hotel room and the centre both want a reservation and a room number — the
 * two forms were byte-identical but for the `id` on each input, which is most
 * of why this step ran to three hundred lines. A home visit wants a street
 * address instead.
 */

function Labelled({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-xs font-medium">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {children}
    </div>
  );
}

/** The button that closes the step, disabled until the answer is usable. */
function ConfirmButton({
  disabled,
  onDone,
}: {
  disabled: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.bookings.form");
  return (
    <Button
      type="button"
      variant="solid"
      size="sm"
      disabled={disabled}
      onClick={onDone}
      className="self-start"
    >
      {t("locations.confirm")}
    </Button>
  );
}

/**
 * A reservation and a room number.
 *
 * `idPrefix` because the centre's copy and the hotel's carry different `id`s,
 * and a label pointing at the wrong input is a label that does nothing.
 */
export function RoomFields({
  idPrefix,
  reservationNumber,
  roomNumber,
  submitting,
  onDone,
  dispatchForm,
}: {
  idPrefix: string;
  reservationNumber: string;
  roomNumber: string;
  submitting: boolean;
  onDone: () => void;
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");

  return (
    <div className="animate-fade-in-up flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Labelled
          id={`${idPrefix}reservationNumber`}
          label={t("fields.reservationNumber")}
          required
        >
          <input
            id={`${idPrefix}reservationNumber`}
            type="text"
            value={reservationNumber}
            onChange={(e) =>
              dispatchForm({
                type: "SET_RESERVATION_NUMBER",
                value: e.target.value,
              })
            }
            placeholder={t("fields.reservationNumberPlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </Labelled>
        <Labelled id={`${idPrefix}roomNumber`} label={t("fields.roomNumber")}>
          <input
            id={`${idPrefix}roomNumber`}
            type="text"
            value={roomNumber}
            onChange={(e) =>
              dispatchForm({ type: "SET_ROOM_NUMBER", value: e.target.value })
            }
            placeholder={t("fields.roomNumberPlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </Labelled>
      </div>
      <ConfirmButton disabled={!reservationNumber.trim()} onDone={onDone} />
    </div>
  );
}

/** Street, building, postcode and municipality, for a visit at home. */
export function HomeAddressFields({
  address,
  submitting,
  onDone,
  dispatchForm,
}: {
  address: LocationAddress;
  submitting: boolean;
  onDone: () => void;
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");

  const set = (part: Partial<LocationAddress>) =>
    dispatchForm({ type: "SET_ADDRESS", value: { ...address, ...part } });

  return (
    <div className="animate-fade-in-up flex flex-col gap-4">
      <Labelled id="addr-street" label={t("fields.street")} required>
        <input
          id="addr-street"
          type="text"
          value={address.street}
          onChange={(e) => set({ street: e.target.value })}
          placeholder={t("fields.streetPlaceholder")}
          autoComplete="address-line1"
          disabled={submitting}
          className={INPUT_CLASS}
        />
      </Labelled>

      <Labelled id="addr-building" label={t("fields.building")}>
        <input
          id="addr-building"
          type="text"
          value={address.building}
          onChange={(e) => set({ building: e.target.value })}
          placeholder={t("fields.buildingPlaceholder")}
          autoComplete="address-line2"
          disabled={submitting}
          className={INPUT_CLASS}
        />
      </Labelled>

      <div className="grid grid-cols-2 gap-4">
        <Labelled id="addr-postal" label={t("fields.postalCode")} required>
          <input
            id="addr-postal"
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={address.postalCode}
            onChange={(e) => set({ postalCode: e.target.value })}
            placeholder={t("fields.postalCodePlaceholder")}
            autoComplete="postal-code"
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </Labelled>
        <Labelled
          id="addr-municipality"
          label={t("fields.municipality")}
          required
        >
          <input
            id="addr-municipality"
            type="text"
            list="dash-municipalities"
            value={address.municipality}
            onChange={(e) => set({ municipality: e.target.value })}
            placeholder={t("fields.municipalityPlaceholder")}
            autoComplete="address-level2"
            disabled={submitting}
            className={INPUT_CLASS}
          />
          <datalist id="dash-municipalities">
            {TENERIFE_MUNICIPALITIES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Labelled>
      </div>

      <ConfirmButton
        disabled={
          !address.street.trim() ||
          !address.postalCode.trim() ||
          !address.municipality.trim()
        }
        onDone={onDone}
      />
    </div>
  );
}
