"use client";

import type { SupportedLocale } from "@/utils/format";
import type { WhatsAppMessageRow } from "@/lib/whatsapp/types";
import type {
  BookingDetail,
  ClientContact,
  CreatorProfile,
  StaffPerson,
} from "./types";
import {
  ClientCard,
  DateTimeCard,
  LocationCard,
  MetaStrip,
  NotesCard,
  ReservedByCard,
  ServiceCard,
  StaffCard,
  WhatsAppCard,
} from "./booking-detail-sections";
import { displayNotes } from "./booking-notes";

/**
 * Everything known about one booking: the strip along the top, then a card for
 * the service, the professional, the messages sent to them, where it happens,
 * when, who booked it and what they wrote.
 *
 * The order they appear in is the only thing this file decides; each card reads
 * its own fields and brings its own wording.
 */
export function BookingDetailBody({
  booking,
  creator,
  contact,
  whatsappMessages,
  staffPerson,
  locale,
}: {
  booking: BookingDetail;
  creator: CreatorProfile | null;
  /** The client's record, when the booking is linked to one. */
  contact: ClientContact | null;
  whatsappMessages: WhatsAppMessageRow[];
  /** The professional assigned to it, if the booking has one. */
  staffPerson: StaffPerson | null;
  locale: SupportedLocale;
}) {
  const notes = displayNotes(booking.notes);

  return (
    <>
      <MetaStrip booking={booking} locale={locale} />

      <div className="space-y-6">
        <ServiceCard booking={booking} staffPerson={staffPerson} />
        {staffPerson && <StaffCard staffPerson={staffPerson} />}
        {whatsappMessages.length > 0 && (
          <WhatsAppCard messages={whatsappMessages} locale={locale} />
        )}
        {booking.location && <LocationCard booking={booking} />}
        <DateTimeCard booking={booking} locale={locale} />
        <ClientCard booking={booking} contact={contact} locale={locale} />
        {notes && <NotesCard notes={notes} />}
        <ReservedByCard booking={booking} creator={creator} />
      </div>
    </>
  );
}
