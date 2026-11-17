import {
  EMAIL_ADDRESS,
  bookingDetailsCard,
  calendarButton,
  cancellationLink,
  consentBlock,
  escapeHtml,
  googleCalendarUrl,
} from "@/emails/templates/_base";
import { formatPrice } from "@/utils/format";
import type { MessageKey } from "./catalog";

/**
 * The blocks the code adds after the body an admin edits: the data, the links
 * and the rules a free-text editor cannot be trusted to keep intact.
 *
 * Each message's blocks come out in the order its legacy template prints them.
 * The helpers from `_base.ts` are used wherever the legacy template used them;
 * the three that the legacy templates write inline (the paid confirmation's
 * own card and location, the payment sentence, the voucher card) are copied
 * here, markup included, so a custom email looks like the one it replaces.
 *
 * Pure: everything it needs arrives as data.
 */

export type FixedBlocksData = {
  locale: "en" | "es";
  service: string;
  sessionType?: string | null;
  /** Already formatted by the caller. */
  date: string;
  time: string;
  duration?: string | null;
  /** YYYY-MM-DD: only feeds the calendar button, which needs it. */
  dateIso?: string;
  cancelUrl?: string | null;
  consentUrl?: string | null;
  /** `booking_received`: set only when the client pays at the centre. */
  amountDueEur?: number | null;
  /** `booking_paid`: what this payment charged, and what is still owed. */
  paidEur?: number;
  owedEur?: number;
  /** `bonus_purchase`. */
  bonus?: {
    sessions: number;
    /** Already formatted, currency included. */
    amount: string;
    /** Already formatted. */
    expiresOn: string;
  };
};

const LABEL_STYLE =
  "margin:0 0 4px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;";

/** The centre's address, as `booking_confirmed` and the reminder print it. */
function locationBlock(
  locale: "en" | "es",
  lines: [string, string] = [
    "Rambla de Santa Cruz, 83",
    "38004 Santa Cruz de Tenerife",
  ],
): string {
  return `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td>
              <p style="${LABEL_STYLE}">${locale === "es" ? "Ubicación" : "Location"}</p>
              <p style="margin:0;font-size:15px;color:#103838;line-height:1.5;">
                ${lines[0]}<br />${lines[1]}
              </p>
            </td>
          </tr>
        </table>`;
}

function calendarFor(
  d: FixedBlocksData,
  location: string = EMAIL_ADDRESS,
): string {
  if (!d.dateIso) return "";
  return calendarButton(
    googleCalendarUrl({
      dateIso: d.dateIso,
      time: d.time,
      service: d.service,
      duration: d.duration,
      location,
    }),
    d.locale,
  );
}

function detailsCard(d: FixedBlocksData): string {
  return bookingDetailsCard({
    service: d.service,
    sessionType: d.sessionType,
    date: d.date,
    time: d.time,
    duration: d.duration,
    locale: d.locale,
  });
}

function cancelBlock(d: FixedBlocksData): string {
  return d.cancelUrl ? cancellationLink(d.cancelUrl, d.locale) : "";
}

/** `booking_received`: only when the client chose to pay at the centre. */
function receivedPaymentNote(d: FixedBlocksData): string {
  if (d.amountDueEur == null) return "";
  return d.locale === "es"
    ? `<p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
             Has elegido pagar en el centro: el día de tu sesión abonarás <strong>${d.amountDueEur} €</strong>, el precio íntegro del tratamiento.
           </p>`
    : `<p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
             You chose to pay at the centre: on the day of your session you will pay <strong>€${d.amountDueEur}</strong>, the full price of the treatment.
           </p>`;
}

const PAID_ADDRESS = "C/ La Noria 14, Santa Cruz de Tenerife";

/**
 * `booking_paid`: the card carries the payment rows too, and the address is
 * the one that template prints (which is not the one the rest print).
 */
function paidBlocks(d: FixedBlocksData): string[] {
  const es = d.locale === "es";
  const t = es
    ? {
        sectionLabel: "Detalles de la sesión",
        service: "Servicio",
        date: "Fecha",
        time: "Hora",
        duration: "Duración",
        paid: "Pagado",
        owed: "Pendiente de pago en el centro",
        owedNote: "El resto se abona el día de la sesión.",
      }
    : {
        sectionLabel: "Session details",
        service: "Service",
        date: "Date",
        time: "Time",
        duration: "Duration",
        paid: "Paid",
        owed: "Due at the centre",
        owedNote: "The balance is paid on the day of your session.",
      };

  const hasOwed = d.owedEur != null && d.owedEur > 0;
  const rowStyle = (last: boolean) =>
    `padding:6px 0;${last ? "" : "border-bottom:1px solid #d7dbd9;"}font-size:14px;`;
  const paymentRows = [
    d.paidEur != null && d.paidEur > 0
      ? [t.paid, formatPrice(d.paidEur, d.locale)]
      : null,
    hasOwed ? [t.owed, formatPrice(d.owedEur, d.locale)] : null,
  ].filter((row): row is string[] => row !== null);
  const paymentHtml = paymentRows
    .map(
      ([label, value], i) => `
                      <tr>
                        <td style="${rowStyle(i === paymentRows.length - 1)}color:#4a6767;">${label}</td>
                        <td style="${rowStyle(i === paymentRows.length - 1)}font-weight:500;color:#103838;">${value}</td>
                      </tr>`,
    )
    .join("");

  const card = `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">${t.sectionLabel}</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;color:#4a6767;width:40%;">${t.service}</td>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;font-weight:500;color:#103838;">${d.service}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;color:#4a6767;">${t.date}</td>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;font-weight:500;color:#103838;">${d.date}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;color:#4a6767;">${t.time}</td>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;font-weight:500;color:#103838;">${d.time}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;${paymentRows.length ? "border-bottom:1px solid #d7dbd9;" : ""}font-size:14px;color:#4a6767;">${t.duration}</td>
                        <td style="padding:6px 0;${paymentRows.length ? "border-bottom:1px solid #d7dbd9;" : ""}font-size:14px;font-weight:500;color:#103838;">${d.duration ?? ""}</td>
                      </tr>${paymentHtml}
                    </table>
                  </td>
                </tr>
              </table>`;

  return [
    card,
    locationBlock(d.locale, ["C/ La Noria 14", "Santa Cruz de Tenerife"]),
    hasOwed
      ? `<p style="margin:0 0 20px;font-size:14px;color:#335554;line-height:1.6;">${t.owedNote}</p>`
      : "",
    calendarFor(d, PAID_ADDRESS),
    consentBlock(d.consentUrl, d.locale),
  ];
}

/** `bonus_purchase`: what was bought, what was paid, until when. */
function bonusCard(d: FixedBlocksData): string {
  const es = d.locale === "es";
  const bonus = d.bonus;
  if (!bonus) return "";
  const rows: [string, string][] = es
    ? [
        ["Servicio", d.service],
        ["Sesiones", String(bonus.sessions)],
        ["Importe pagado", bonus.amount],
        ["Válido hasta", bonus.expiresOn],
      ]
    : [
        ["Service", d.service],
        ["Sessions", String(bonus.sessions)],
        ["Amount paid", bonus.amount],
        ["Valid until", bonus.expiresOn],
      ];
  const rowsHtml = rows
    .map(
      ([label, value], i) => `
        <tr>
          <td style="padding:6px 0;${i < rows.length - 1 ? "border-bottom:1px solid #d7dbd9;" : ""}font-size:14px;color:#4a6767;width:40%;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;${i < rows.length - 1 ? "border-bottom:1px solid #d7dbd9;" : ""}font-size:14px;font-weight:500;color:#103838;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
  return `
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">${es ? "Tu bono" : "Your voucher"}</p>
            <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}
            </table>
          </td>
        </tr>
      </table>`;
}

/**
 * The fixed blocks of a message, one string each, in the order its legacy
 * template prints them. Empty blocks (no link, nothing owed) are left out.
 */
export function fixedBlocks(key: MessageKey, d: FixedBlocksData): string[] {
  const blocks = ((): string[] => {
    switch (key) {
      case "booking_received":
        return [detailsCard(d), receivedPaymentNote(d), cancelBlock(d)];
      case "booking_confirmed":
        return [
          detailsCard(d),
          locationBlock(d.locale),
          calendarFor(d),
          consentBlock(d.consentUrl, d.locale),
          cancelBlock(d),
        ];
      case "booking_paid":
        return paidBlocks(d);
      case "booking_rescheduled":
        return [detailsCard(d), calendarFor(d), cancelBlock(d)];
      case "booking_cancelled":
        return [detailsCard(d)];
      case "booking_reminder":
        return [
          detailsCard(d),
          locationBlock(d.locale),
          calendarFor(d),
          cancelBlock(d),
        ];
      case "consent_request":
        return [consentBlock(d.consentUrl, d.locale)];
      case "bonus_purchase":
        return [bonusCard(d)];
    }
  })();
  return blocks.filter((block) => block !== "");
}

/** The fixed blocks as one piece of HTML, to set after the body. */
export function fixedBlocksHtml(key: MessageKey, d: FixedBlocksData): string {
  return fixedBlocks(key, d).join("\n");
}
