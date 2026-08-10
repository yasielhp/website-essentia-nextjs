"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import {
  LocationSelect,
  TENERIFE_MUNICIPALITIES,
  type DashboardLocation,
  type LocationAddress,
  type LocationOption,
} from "../_shared/location";
import type { FormAction } from "./form-state";
import { CompletedRow } from "./completed-row";

/**
 * Where the session happens, and the address it needs.
 *
 * The centre needs nothing; a hotel room needs a reservation and a room number;
 * a home visit needs a street, a building, a postcode and a municipality. Which
 * of the three is on show is most of the two hundred and eighty lines this used
 * to occupy in the middle of the booking form.
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

  return (
    <>
      {location && !editing ? (
        <CompletedRow
          label={t("steps.location")}
          value={locationLabel}
          onEdit={onEdit}
        />
      ) : (
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

            {location === "centro" && (
              <div className="animate-fade-in-up flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="centro-reservationNumber"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {t("fields.reservationNumber")}{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="centro-reservationNumber"
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
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="centro-roomNumber"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {t("fields.roomNumber")}
                    </label>
                    <input
                      id="centro-roomNumber"
                      type="text"
                      value={roomNumber}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_ROOM_NUMBER",
                          value: e.target.value,
                        })
                      }
                      placeholder={t("fields.roomNumberPlaceholder")}
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="solid"
                  size="sm"
                  disabled={!reservationNumber.trim()}
                  onClick={onDone}
                  className="self-start"
                >
                  {t("locations.confirm")}
                </Button>
              </div>
            )}

            {location === "habitacion" && (
              <div className="animate-fade-in-up flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="reservationNumber"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {t("fields.reservationNumber")}{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="reservationNumber"
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
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="roomNumber"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {t("fields.roomNumber")}
                    </label>
                    <input
                      id="roomNumber"
                      type="text"
                      value={roomNumber}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_ROOM_NUMBER",
                          value: e.target.value,
                        })
                      }
                      placeholder={t("fields.roomNumberPlaceholder")}
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="solid"
                  size="sm"
                  disabled={!reservationNumber.trim()}
                  onClick={onDone}
                  className="self-start"
                >
                  {t("locations.confirm")}
                </Button>
              </div>
            )}

            {location === "domicilio" && (
              <div className="animate-fade-in-up flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="addr-street"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.street")} <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="addr-street"
                    type="text"
                    value={address.street}
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_ADDRESS",
                        value: { ...address, street: e.target.value },
                      })
                    }
                    placeholder={t("fields.streetPlaceholder")}
                    autoComplete="address-line1"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="addr-building"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.building")}
                  </label>
                  <input
                    id="addr-building"
                    type="text"
                    value={address.building}
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_ADDRESS",
                        value: { ...address, building: e.target.value },
                      })
                    }
                    placeholder={t("fields.buildingPlaceholder")}
                    autoComplete="address-line2"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="addr-postal"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {t("fields.postalCode")}{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="addr-postal"
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={address.postalCode}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_ADDRESS",
                          value: {
                            ...address,
                            postalCode: e.target.value,
                          },
                        })
                      }
                      placeholder={t("fields.postalCodePlaceholder")}
                      autoComplete="postal-code"
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="addr-municipality"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {t("fields.municipality")}{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="addr-municipality"
                      type="text"
                      list="dash-municipalities"
                      value={address.municipality}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_ADDRESS",
                          value: {
                            ...address,
                            municipality: e.target.value,
                          },
                        })
                      }
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
                  </div>
                </div>
                <Button
                  type="button"
                  variant="solid"
                  size="sm"
                  disabled={
                    !address.street.trim() ||
                    !address.postalCode.trim() ||
                    !address.municipality.trim()
                  }
                  onClick={onDone}
                  className="self-start"
                >
                  {t("locations.confirm")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
