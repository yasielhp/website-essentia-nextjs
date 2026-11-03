# Reapertura de diciembre — plan de implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Lee `CLAUDE.md` antes de empezar. Cada tarea termina con `bun run format && bun run lint && bun run build` en verde y un commit.

**Fecha:** 2026-11-02
**Origen:** reunión con Essentia del 2026-11-02 (notas en `docs/plans/2026-11-02-reunion-essentia.md` si se guardan; resumen en la memoria `project_reopening_dec_2026`).

**Goal:** reabrir la agenda pública en diciembre con pago obligatorio al reservar (50% o 100%), y dar al CRM lo que el centro pidió: ficha de contacto con detalles, consentimiento firmado y bonos; reserva desde la ficha; automatización post‑drenaje para clientas nuevas.

**Architecture:** todo vive en el monolito Next.js 16 + Insforge ya existente. Cada bloque añade una migración SQL en `insforge/migrations/`, un módulo puro testeado con `bun test` cuando hay lógica de negocio, Server Actions con `requireRole` para escrituras del dashboard, y componentes cliente en el dashboard siguiendo los patrones ya presentes (reducers, `TabButton`, modales `fixed inset-0 z-50`). Redsys sigue siendo la única pasarela. El email sigue siendo Resend; la automatización reutiliza el motor de campañas y su cron de 15 min.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind v4, next-intl 4, `@insforge/sdk`, `redsys-easy`, Resend, Zod 4, `bun test`.

---

## Orden de fases y por qué

| Fase | Qué | Bloquea |
|---|---|---|
| 1 | Pago con depósito al reservar + reactivar `/booking` | La reapertura. Sin esto no se abre la agenda. |
| 2 | Ficha de contacto: pestañas, buscador por nombre, nueva reserva desde ficha, panel lateral en el calendario | Nada, pero es el día a día del centro y es barato. |
| 3 | Bonos | Depende de la fase 2 (pestañas). |
| 4 | Consentimiento informado con firma | Depende de la fase 2. Documento recibido el 2026-11-03; campos definitivos. |
| 5 | Automatización post‑visita para clientas nuevas | Independiente. |
| 6 | Varios: hero, MCP de blog, facial Anesis, notas operativas | Independiente. |

Ejecutar 1 → 2 → 3 → 4 → 5 → 6.

## Hechos del código que el ejecutor necesita saber

- Hay **dos carpetas de migraciones**: `migrations/` (antiguas) e `insforge/migrations/` (actuales). Las nuevas van en `insforge/migrations/`. Se aplican a mano: `npx @insforge/cli@latest db query "$(cat insforge/migrations/<fichero>.sql)"` desde la raíz. Verificar después con una consulta a `information_schema.columns`.
- `bookings.payment_status` y `bookings.stripe_session_id` **existen en la BD viva pero ninguna migración las crea**. `payment_status text DEFAULT 'pending'`, nullable. Estado real a 2026‑11‑02: 136 `confirmed/pending`, 27 `draft/pending`, 11 `cancelled/pending`, 5 `pending/pending`, 2 `paid`. `stripe_session_id` guarda el order id de Redsys.
- No hay CHECK sobre `bookings.status` ni `bookings.payment_status`.
- La RPC `update_booking_returning_previous(p_id, p_payload)` (`insforge/migrations/20260814c_update_booking_returning_previous.sql`) solo escribe claves de una lista blanca; **no incluye `payment_status`**.
- `handleBookingPaid()` vive en `app/services/booking-payments.service.ts` y **no** es Server Action a propósito (sería un endpoint público). Mantener eso.
- `confirmDraftBooking()` en `app/actions/booking-draft.ts:261-270` **sobrescribe `price_eur` con el precio de centro** aunque la reserva sea online. Bug a corregir en la fase 1.
- Cliente admin: `getAdminClient()` en `app/lib/insforge-admin.ts` (service key, solo servidor). Cliente navegador: `insforge` en `app/lib/insforge.ts`. Token en cliente: `getAccessToken()` de `@/lib/client-session`.
- Auth en Server Actions: `requireRole(token, allowed = DASHBOARD_ROLES)` devuelve `{ userId, email, role }`. `ADMIN_ROLES = ["admin"]`, `DASHBOARD_ROLES = ["admin","staff","partner"]` en `app/lib/auth-guard.ts`.
- Historial de reserva: `recordBookingEvent({ bookingId, channel, event, actorId?, actorRole?, status?, summary, payload?, providerId? })` en `app/lib/booking-events/record.ts`. Canales `whatsapp|email|system|payment|calendar`; eventos `assigned|unassigned|rescheduled|cancelled|confirmed|received|created|edited|deleted|paid|failed|synced|removed` (`app/lib/booking-events/types.ts`). Las etiquetas están en `dashboard.bookings.detail.history.events.*`.
- Traducciones del dashboard: `messages/{en,es}/dashboard.json`, un solo namespace `dashboard`. Las de la web pública: un fichero por namespace, lista en `i18n/request.ts` (`namespaces`). **Añadir un namespace nuevo exige añadirlo a esa lista y reiniciar `bun run dev`.** Siempre EN y ES.
- Tests: `bun test`, ficheros `*.test.ts` junto al módulo, `import { describe, expect, it } from "bun:test"`.
- `drenaje linfático` es el tier `59d57d59-7b9b-4e32-83fe-c144ec7e8a24` (`service_tiers.label = 'Drenaje Linfático Avanzado'`, `service_id = 'manual-therapies'`).
- No hay primitivas `Dialog`, `Sheet` ni `Tabs` en `app/components/ui/`. Los modales son overlays escritos a mano; el mejor para copiar es `app/components/dashboard/calendar/calendar-filters-modal.tsx` (gestiona Escape y clic fuera). `TabButton` está en `app/components/dashboard/settings/tab-button.tsx`.
- `/dashboard/contacts` redirige a `/dashboard/users`; la lista real y su buscador están en `app/(dashboard)/dashboard/users/page.tsx`.

---

# FASE 1 — Pago al reservar (depósito 50% o 100%)

## Decisiones

| Decisión | Elegido | Por qué |
|---|---|---|
| Opciones de pago en la web | Solo dos: **50% ahora** o **100% ahora**. Desaparece "pagar en el centro". | El centro lo dijo literalmente: "todo el mundo tiene que pagar el 50% de todo". |
| Descuento por pagar el 100% | Configurable en Ajustes → Pagos, **por defecto 5%**. | El centro lo pidió; si no funciona, lo pone a 0 sin tocar código. |
| Porcentaje del depósito | Configurable, por defecto 50. | Mismo motivo. |
| Dónde viven esos ajustes | Tabla nueva `app_settings(key, value jsonb)`. | No hay tabla de ajustes globales; `service_configs` es solo Google. |
| Qué guarda la reserva | `price_eur` = precio final acordado (con descuento si pagó todo), `amount_paid_eur` = lo cobrado, `payment_mode` = `deposit\|full\|bonus\|none`, `balance_settled_at/_method`. | El centro necesita ver "pagó X, debe Y" sin calcular nada. |
| `payment_status` nuevo valor | `deposit_paid`. Se añade CHECK con `pending\|deposit_paid\|paid\|failed\|refunded`. | Hoy no hay CHECK y nada lo escribe salvo `paid`/`failed`. |
| Cobro del saldo en el centro | Botón "Cobrar saldo" en el detalle de la reserva; pide método (efectivo/tarjeta/otro); escribe un evento `payment/paid` con actor. | Es lo que preguntó el centro: "ver que ha pagado 50 para cobrarle la diferencia". |
| Reservas manuales | Sección "Pago" en el formulario del dashboard: estado, importe cobrado, método. | "Que me quiere pagar los 50 en efectivo" → se registra en la reserva manual. |
| Importe real cobrado | Se lee de `Ds_Amount` en el webhook, no de `price_eur`. | Hoy se asume que `price_eur` es lo cobrado; con depósitos ya no es verdad. |
| Devoluciones | **Fuera de esta versión.** `RedsysProvider.createRefund` sigue lanzando. | Política de cancelación no definida por el centro. Pendiente de decidir. |

## Tarea 1.1 — Migración: columnas de pago y tabla de ajustes

**Files:**
- Create: `insforge/migrations/20261102_booking_deposits.sql`

**Step 1: Escribir la migración**

```sql
-- Pago parcial al reservar (reunión 2026-11-02): la reserva guarda qué modo
-- eligió la clienta, cuánto ha pagado y cuándo se cobró el resto en el centro.

-- payment_status existe en la BD viva sin migración; se normaliza aquí.
UPDATE bookings SET payment_status = 'pending' WHERE payment_status IS NULL;
ALTER TABLE bookings
  ALTER COLUMN payment_status SET DEFAULT 'pending',
  ALTER COLUMN payment_status SET NOT NULL;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('pending','deposit_paid','paid','failed','refunded'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS amount_paid_eur numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_settled_method text;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_mode_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_mode_check
  CHECK (payment_mode IS NULL OR payment_mode IN ('deposit','full','bonus','none'));
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_balance_method_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_balance_method_check
  CHECK (balance_settled_method IS NULL OR balance_settled_method IN ('cash','card','transfer','other'));

-- Las dos reservas ya pagadas pagaron el importe completo.
UPDATE bookings SET amount_paid_eur = COALESCE(price_eur, 0), payment_mode = 'full'
  WHERE payment_status = 'paid' AND amount_paid_eur = 0;

COMMENT ON COLUMN bookings.payment_mode IS 'deposit | full | bonus | none — how the client chose to pay; null for rows older than 2026-11';
COMMENT ON COLUMN bookings.amount_paid_eur IS 'Sum actually collected so far (Redsys + counter). price_eur - amount_paid_eur is what is owed.';

-- Ajustes globales: una fila por clave. Solo el service key lee y escribe.
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO app_settings (key, value) VALUES
  ('payments', '{"depositPercent": 50, "fullPaymentDiscountPercent": 5, "requirePayment": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- La RPC de edición necesita poder escribir el pago desde el dashboard.
-- Se reescribe entera porque Postgres no edita listas blancas por partes.
```

Después del comentario anterior, copiar el cuerpo completo de `update_booking_returning_previous` de `insforge/migrations/20260814c_update_booking_returning_previous.sql` y añadir `payment_status`, `payment_mode`, `amount_paid_eur`, `balance_settled_at`, `balance_settled_method` a la lista blanca de claves, con la misma técnica que ya usa para las demás (`CASE WHEN p_payload ? 'payment_status' THEN ... ELSE payment_status END`). Mantener `CREATE OR REPLACE FUNCTION` con la misma firma.

**Step 2: Aplicar**

Run: `npx @insforge/cli@latest db query "$(cat insforge/migrations/20261102_booking_deposits.sql)"`

**Step 3: Verificar**

Run: `npx @insforge/cli@latest db query "select column_name, data_type, column_default, is_nullable from information_schema.columns where table_name='bookings' and column_name in ('payment_status','payment_mode','amount_paid_eur','balance_settled_at','balance_settled_method')"`
Expected: 5 filas; `payment_status` `is_nullable = NO`.

Run: `npx @insforge/cli@latest db query "select * from app_settings"`
Expected: 1 fila `payments`.

**Step 4: Commit**

```bash
git add insforge/migrations/20261102_booking_deposits.sql
git commit -m "feat(db): booking deposits, settled balance and app_settings"
```

## Tarea 1.2 — Módulo puro: importes y estados

**Files:**
- Create: `app/lib/payments/amounts.ts`
- Test: `app/lib/payments/amounts.test.ts`

**Step 1: Escribir el test**

```ts
import { describe, expect, it } from "bun:test";
import {
  chargeForMode,
  paymentStatusAfter,
  amountOwed,
  type PaymentSettings,
} from "./amounts";

const settings: PaymentSettings = {
  depositPercent: 50,
  fullPaymentDiscountPercent: 5,
  requirePayment: true,
};

describe("chargeForMode", () => {
  it("deposit charges the deposit percent of the list price, rounded to cents", () => {
    expect(chargeForMode(100, "deposit", settings)).toEqual({
      chargeEur: 50,
      finalPriceEur: 100,
    });
    expect(chargeForMode(99.99, "deposit", settings)).toEqual({
      chargeEur: 50,
      finalPriceEur: 99.99,
    });
  });

  it("full charges the discounted price and records it as the final price", () => {
    expect(chargeForMode(100, "full", settings)).toEqual({
      chargeEur: 95,
      finalPriceEur: 95,
    });
  });

  it("full with no discount charges the list price", () => {
    expect(
      chargeForMode(100, "full", { ...settings, fullPaymentDiscountPercent: 0 }),
    ).toEqual({ chargeEur: 100, finalPriceEur: 100 });
  });

  it("refuses a non-positive price", () => {
    expect(() => chargeForMode(0, "deposit", settings)).toThrow();
  });
});

describe("paymentStatusAfter", () => {
  it("is paid when the money covers the price", () => {
    expect(paymentStatusAfter(95, 95)).toBe("paid");
    expect(paymentStatusAfter(100, 95)).toBe("paid");
  });
  it("is deposit_paid when something but not all came in", () => {
    expect(paymentStatusAfter(50, 100)).toBe("deposit_paid");
  });
  it("is pending when nothing came in", () => {
    expect(paymentStatusAfter(0, 100)).toBe("pending");
  });
});

describe("amountOwed", () => {
  it("never goes negative", () => {
    expect(amountOwed(100, 50)).toBe(50);
    expect(amountOwed(95, 100)).toBe(0);
    expect(amountOwed(null, 0)).toBe(0);
  });
});
```

**Step 2: Ejecutar y ver fallar**

Run: `bun test app/lib/payments/amounts.test.ts`
Expected: FAIL, "Cannot find module './amounts'".

**Step 3: Implementar**

```ts
/**
 * How much to charge at booking time, and what the booking is worth after.
 *
 * Pure so the checkout route, the public confirm step and the dashboard all
 * agree on the number. The server remains the authority: the route reads the
 * list price from `service_tiers` and the settings from `app_settings`, never
 * from the request.
 */

export type PaymentMode = "deposit" | "full";

export type PaymentSettings = {
  /** Share of the list price taken at booking when the client picks "deposit". */
  depositPercent: number;
  /** Discount on the list price when the client pays everything at booking. 0 disables it. */
  fullPaymentDiscountPercent: number;
  /** When false the public form books without paying. Kept for an emergency switch. */
  requirePayment: boolean;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  depositPercent: 50,
  fullPaymentDiscountPercent: 5,
  requirePayment: true,
};

const toCents = (eur: number) => Math.round(eur * 100);
const fromCents = (cents: number) => cents / 100;

export function chargeForMode(
  listPriceEur: number,
  mode: PaymentMode,
  settings: PaymentSettings,
): { chargeEur: number; finalPriceEur: number } {
  if (!Number.isFinite(listPriceEur) || listPriceEur <= 0) {
    throw new Error("listPriceEur must be positive");
  }
  const list = toCents(listPriceEur);
  if (mode === "full") {
    const discounted = Math.round(
      list * (1 - settings.fullPaymentDiscountPercent / 100),
    );
    return { chargeEur: fromCents(discounted), finalPriceEur: fromCents(discounted) };
  }
  const deposit = Math.round(list * (settings.depositPercent / 100));
  return { chargeEur: fromCents(deposit), finalPriceEur: fromCents(list) };
}

export function paymentStatusAfter(
  paidEur: number,
  priceEur: number,
): "pending" | "deposit_paid" | "paid" {
  if (paidEur <= 0) return "pending";
  return toCents(paidEur) >= toCents(priceEur) ? "paid" : "deposit_paid";
}

export function amountOwed(
  priceEur: number | null,
  paidEur: number | null,
): number {
  const owed = toCents(priceEur ?? 0) - toCents(paidEur ?? 0);
  return owed > 0 ? fromCents(owed) : 0;
}
```

**Step 4: Ejecutar y ver pasar**

Run: `bun test app/lib/payments/amounts.test.ts`
Expected: PASS (9 tests).

**Step 5: Commit**

```bash
git add app/lib/payments/amounts.ts app/lib/payments/amounts.test.ts
git commit -m "feat(payments): pure deposit and balance arithmetic"
```

## Tarea 1.3 — Lectura y escritura de `app_settings.payments`

**Files:**
- Create: `app/lib/settings/app-settings.ts`
- Create: `app/actions/payment-settings.ts`
- Modify: `app/lib/schemas.ts` (añadir `paymentSettingsSchema` al final)

**Step 1: Schema Zod** (`app/lib/schemas.ts`, al final)

```ts
export const paymentSettingsSchema = z.object({
  depositPercent: z.number().int().min(10).max(100),
  fullPaymentDiscountPercent: z.number().int().min(0).max(50),
  requirePayment: z.boolean(),
});
```

**Step 2: Lector servidor** (`app/lib/settings/app-settings.ts`)

```ts
import { getAdminClient } from "@/lib/insforge-admin";
import { paymentSettingsSchema } from "@/lib/schemas";
import {
  DEFAULT_PAYMENT_SETTINGS,
  type PaymentSettings,
} from "@/lib/payments/amounts";

/**
 * SERVER ONLY. One row per key in `app_settings`; a missing or malformed row
 * falls back to the defaults so a bad edit cannot take the booking form down.
 */
export async function readPaymentSettings(): Promise<PaymentSettings> {
  const { data } = await getAdminClient()
    .database.from("app_settings")
    .select("value")
    .eq("key", "payments")
    .maybeSingle();
  const parsed = paymentSettingsSchema.safeParse(
    (data as { value: unknown } | null)?.value,
  );
  return parsed.success ? parsed.data : DEFAULT_PAYMENT_SETTINGS;
}

export async function writePaymentSettings(
  value: PaymentSettings,
  userId: string,
): Promise<void> {
  const { error } = await getAdminClient()
    .database.from("app_settings")
    .upsert(
      { key: "payments", value, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}
```

**Step 3: Server Actions** (`app/actions/payment-settings.ts`)

```ts
"use server";

import { ADMIN_ROLES, requireRole } from "@/lib/auth-guard";
import { paymentSettingsSchema } from "@/lib/schemas";
import {
  readPaymentSettings,
  writePaymentSettings,
} from "@/lib/settings/app-settings";
import type { PaymentSettings } from "@/lib/payments/amounts";

/**
 * Public on purpose: the booking form shows "50% now" and "−5% if you pay
 * everything" before anybody is signed in. Nothing secret in it.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function getPublicPaymentSettings(): Promise<PaymentSettings> {
  return readPaymentSettings();
}

export async function savePaymentSettings(
  accessToken: string | null,
  input: PaymentSettings,
): Promise<{ error: string | null }> {
  const { userId } = await requireRole(accessToken, ADMIN_ROLES);
  const parsed = paymentSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  await writePaymentSettings(parsed.data, userId);
  return { error: null };
}
```

> Nota de la memoria `server-action-type-reexport`: **no re-exportar tipos** desde ficheros `"use server"`. Por eso `PaymentSettings` vive en `app/lib/payments/amounts.ts` y aquí solo se importa.

**Step 4: Verificar**

Run: `bun run build`
Expected: compila.

**Step 5: Commit**

```bash
git add app/lib/settings/app-settings.ts app/actions/payment-settings.ts app/lib/schemas.ts
git commit -m "feat(settings): payment settings row with admin-only writes"
```

## Tarea 1.4 — Checkout: el importe depende del modo

**Files:**
- Modify: `app/api/checkout/booking-session/route.ts`

**Step 1: Cambiar el body y el cálculo**

- Añadir `paymentMode?: "deposit" | "full"` a `CheckoutBody`; por defecto `"deposit"`.
- Sustituir el bloque desde `// Paying online means the web price...` hasta `provider.buildFormData({` por:

```ts
  const listPriceEur = Number(tier.price_eur ?? tier.price_center_eur ?? 0);
  if (!Number.isFinite(listPriceEur) || listPriceEur <= 0) {
    return NextResponse.json(
      { error: "Tier has no price configured" },
      { status: 400 },
    );
  }

  const mode: PaymentMode = paymentMode === "full" ? "full" : "deposit";
  const settings = await readPaymentSettings();
  const { chargeEur, finalPriceEur } = chargeForMode(listPriceEur, mode, settings);

  const appUrl = getAppUrl();
  const formData = provider.buildFormData({
    amount: Math.round(chargeEur * 100), // Redsys expects cents
```

- Imports: `import { chargeForMode, type PaymentMode } from "@/lib/payments/amounts";` y `import { readPaymentSettings } from "@/lib/settings/app-settings";`.
- La actualización final pasa a guardar el modo y el precio acordado:

```ts
  await db
    .from("bookings")
    .update({
      stripe_session_id: formData.orderId,
      payment_mode: mode,
      price_eur: finalPriceEur,
    })
    .eq("id", bookingId);
```

- Actualizar el comentario de cabecera: el importe sale del tier **y de `app_settings.payments`**, nunca del body.

**Step 2: Verificar**

Run: `bun run build`
Expected: compila.

**Step 3: Commit**

```bash
git add app/api/checkout/booking-session/route.ts
git commit -m "feat(checkout): charge a deposit or the discounted full price"
```

## Tarea 1.5 — Webhook: registrar lo cobrado de verdad

**Files:**
- Modify: `app/api/webhooks/redsys/route.ts`
- Modify: `app/services/booking-payments.service.ts`
- Modify: `app/emails/templates/booking-confirmation.ts`

**Step 1: Pasar el importe del webhook**

En `app/api/webhooks/redsys/route.ts`, donde hoy hay `await handleBookingPaid(bookingId)`, pasar también el importe en céntimos: `await handleBookingPaid(bookingId, Number(payload.Ds_Amount))`. `Ds_Amount` llega como string de céntimos.

**Step 2: Reescribir `handleBookingPaid`**

```ts
export async function handleBookingPaid(
  bookingId: string,
  amountCents: number,
): Promise<void> {
  const adminClient = getAdminClient();

  const { data: booking } = await adminClient.database
    .from("bookings")
    .select(
      "first_name, last_name, email, service_title, date, time, duration, price_eur, amount_paid_eur, payment_status, stripe_session_id, contact_id",
    )
    .eq("id", bookingId)
    .single();

  if (!booking) {
    console.error("[handleBookingPaid] booking not found:", bookingId);
    return;
  }

  // Redsys retries its notification; a second one must not add the money twice.
  if (booking.payment_status === "paid") return;

  const received = Number.isFinite(amountCents) && amountCents > 0 ? amountCents / 100 : 0;
  const priceEur = booking.price_eur == null ? 0 : Number(booking.price_eur);
  const paidEur = Number(booking.amount_paid_eur ?? 0) + received;
  const paymentStatus = paymentStatusAfter(paidEur, priceEur);
  const owedEur = amountOwed(priceEur, paidEur);

  await adminClient.database
    .from("bookings")
    .update({ payment_status: paymentStatus, amount_paid_eur: paidEur, status: "confirmed" })
    .eq("id", bookingId);

  const orderId = (booking.stripe_session_id as string | null) ?? null;
  await recordBookingEvent({
    bookingId,
    channel: "payment",
    event: "paid",
    actorRole: "system",
    summary:
      owedEur > 0
        ? `Depósito recibido · ${formatPrice(received, "es")} · pendiente ${formatPrice(owedEur, "es")}`
        : `Pago recibido · ${formatPrice(received, "es")}`,
    providerId: orderId,
    payload: { orderId, amountEur: received, owedEur, currency: "EUR" },
  });

  await pushBookingToCalendars(bookingId);
  // ... (contacts upsert igual que hoy)

  const locale = await contactLocale(adminClient, booking.contact_id as string | null, booking.email as string);
  const { error } = await sendEmail({
    to: booking.email as string,
    subject: locale === "es" ? "Tu reserva en Essentia está confirmada" : "Your Essentia booking is confirmed",
    html: bookingConfirmationEmail({
      name: booking.first_name as string,
      serviceName: booking.service_title as string,
      date: formatLongDate(booking.date as string, locale),
      time: booking.time as string,
      duration: booking.duration as string,
      dateIso: booking.date as string,
      locale,
      paidEur: received,
      owedEur,
    }),
  });
  if (error) console.error("[handleBookingPaid] email failed:", error);
}

async function contactLocale(
  client: ReturnType<typeof getAdminClient>,
  contactId: string | null,
  email: string,
): Promise<"en" | "es"> {
  const query = client.database.from("contacts").select("preferred_language");
  const { data } = contactId
    ? await query.eq("id", contactId).maybeSingle()
    : await query.ilike("email", email).maybeSingle();
  return (data as { preferred_language: string | null } | null)?.preferred_language === "en" ? "en" : "es";
}
```

Imports nuevos: `import { amountOwed, paymentStatusAfter } from "@/lib/payments/amounts";`.

**Step 3: Plantilla con importes**

En `app/emails/templates/booking-confirmation.ts` añadir a los props `paidEur?: number; owedEur?: number;` y, dentro de la tabla de detalles, tras la fila de duración, una fila "Pagado" y, si `owedEur > 0`, una fila "Pendiente (se abona en el centro)". Textos:

- ES: `paid: "Pagado"`, `owed: "Pendiente de pago en el centro"`, `owedNote: "El resto se abona el día de la sesión."`
- EN: `paid: "Paid"`, `owed: "Due at the centre"`, `owedNote: "The balance is paid on the day of your session."`

Usar `formatPrice(x, locale)` de `@/utils/format`.

**Step 4: Verificar**

Run: `bun run build`
Expected: compila. Probar en entorno `test` de Redsys: una reserva de 100 € en modo `deposit` deja `amount_paid_eur = 50`, `payment_status = deposit_paid`, un evento `payment/paid` con "pendiente 50,00 €" y un email con ambas cifras.

**Step 5: Commit**

```bash
git add app/api/webhooks/redsys/route.ts app/services/booking-payments.service.ts app/emails/templates/booking-confirmation.ts
git commit -m "feat(payments): record the amount Redsys actually charged"
```

## Tarea 1.6 — Corregir el precio que pisaba `confirmDraftBooking`

**Files:**
- Modify: `app/actions/booking-draft.ts:112-171` (`updateDraftBookingMeta`) y `:225-300` (`confirmDraftBooking`)

**Step 1: `updateDraftBookingMeta`**

- Cambiar el parámetro `paymentMethod: "online" | "on-site" = "online"` por `paymentMode: "deposit" | "full" = "deposit"`.
- El precio que se guarda es siempre `onlinePriceEur` (precio web). La nota pasa a ser:

```ts
  const paymentNote =
    paymentMode === "full" ? "Pago: 100% online al reservar" : "Pago: depósito online al reservar";
```

- Guardar también `payment_mode: paymentMode`.

**Step 2: `confirmDraftBooking`**

Quitar `price_eur: tierPrice` del `.update({...})`. El parámetro `tierPrice` se mantiene en la firma (los llamadores lo pasan) pero se renombra `_tierPrice` y se documenta: "ignorado: el precio lo fijan `updateDraftBookingMeta` y el checkout".

**Step 3: Verificar**

Run: `bun run build && grep -n "on-site" app/actions/booking-draft.ts`
Expected: compila; el grep no devuelve nada.

**Step 4: Commit**

```bash
git add app/actions/booking-draft.ts
git commit -m "fix(booking): the draft confirm no longer overwrites the agreed price"
```

## Tarea 1.7 — Formulario público: "50% ahora" o "100% ahora"

**Files:**
- Modify: `app/components/sections/booking/steps/confirm-step.tsx`
- Modify: `app/components/sections/booking/booking-content.tsx:67` y `:200-227`
- Modify: `app/components/sections/booking/booking-submit.ts:195-324`
- Modify: `messages/en/booking.json`, `messages/es/booking.json` (`confirmStep`)
- Modify: cualquier fichero que importe `PaymentMethod` (grep `PaymentMethod` en `app/components/sections/booking/` y `app/types/`)

**Step 1: Tipo**

En `confirm-step.tsx` sustituir `export type PaymentMethod = "online" | "on-site";` por `export type { PaymentMode as PaymentMethod } from "@/lib/payments/amounts";` o, mejor, renombrar en toda la carpeta a `PaymentMode` importado de `@/lib/payments/amounts`.

**Step 2: Leer los ajustes**

En `ConfirmStep`, junto al `useEffect` que lee el tier (`:89-113`), añadir:

```ts
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  useEffect(() => {
    getPublicPaymentSettings().then(setSettings).catch(() => {});
  }, []);
```

**Step 3: Importes**

El precio de lista es `onlineFinal ?? centrePrice` (el precio web). Calcular:

```ts
  const listPrice = onlineFinal ?? centrePrice;
  const deposit = listPrice != null ? chargeForMode(listPrice, "deposit", settings) : null;
  const full = listPrice != null ? chargeForMode(listPrice, "full", settings) : null;
  const chosen = paymentMethod === "full" ? full : deposit;
```

**Step 4: Tarjetas**

Sustituir el array `methods` por:

```ts
  const methods = [
    {
      id: "deposit" as const,
      icon: CreditCard,
      title: t("payDeposit", { percent: settings.depositPercent }),
      note: deposit
        ? t("payDepositNote", { now: formatPrice(deposit.chargeEur, locale), later: formatPrice(amountOwed(deposit.finalPriceEur, deposit.chargeEur), locale) })
        : "",
    },
    {
      id: "full" as const,
      icon: BadgePercent,
      title: settings.fullPaymentDiscountPercent > 0
        ? t("payFullDiscount", { percent: settings.fullPaymentDiscountPercent })
        : t("payFull"),
      note: full ? t("payFullNote", { now: formatPrice(full.chargeEur, locale) }) : "",
    },
  ];
```

`BadgePercent` existe en `lucide-react`. `formatPrice` en `@/utils/format`.

**Step 5: Bloque "Qué cuesta"**

Sustituir las filas Precio/Descuento/Total por: Precio (`listPrice`), si `paymentMethod === "full"` y hay descuento una fila Descuento (`−X €`), fila **"Pagas ahora"** (`chosen.chargeEur`, grande) y si `paymentMethod === "deposit"` una fila "En el centro" (`amountOwed(...)`).

**Step 6: Traducciones** (`messages/es/booking.json` → `confirmStep`; añadir equivalentes en EN)

```json
"payDeposit": "Pagar el {percent}% ahora",
"payDepositNote": "Pagas {now} hoy y {later} el día de la sesión.",
"payFull": "Pagar todo ahora",
"payFullDiscount": "Pagar todo ahora (−{percent}%)",
"payFullNote": "Pagas {now} hoy y no tienes nada pendiente.",
"payNowLabel": "Pagas ahora",
"payLaterLabel": "En el centro",
"paymentHeading": "¿Cómo quieres reservar?",
"cancellationNote": "La reserva se confirma con el pago. Si necesitas cambiarla, escríbenos con 24 h de antelación."
```

EN: `"Pay {percent}% now"`, `"You pay {now} today and {later} on the day."`, `"Pay in full now"`, `"Pay in full now (−{percent}%)"`, `"You pay {now} today and nothing later."`, `"You pay now"`, `"At the centre"`, `"How would you like to book?"`, `"Your booking is confirmed by the payment. To change it, write to us 24 h ahead."`.

Eliminar las claves `payOnline`, `payOnlineNote`, `payOnlineNoteNoDiscount`, `payOnSite`, `payOnSiteNote` si ya nadie las usa (grep).

**Step 7: `booking-content.tsx`**

- `:67`: `useState<PaymentMode>("deposit")`.
- `handleConfirm`: el resultado ya no tiene `kind: "on-site"`; quitar esa rama. Si `result.kind === "unpaid"`, llevar a `/booking/requested?...&payment=unpaid` (la página `requested` ya tiene `bodyPayOnSite`; añadir `bodyUnpaid`: "No hemos podido abrir el pago. Te escribimos para completarlo.").

**Step 8: `booking-submit.ts`**

- `ConfirmResult` pierde `{ kind: "on-site" }`.
- Quitar `amountDueEur: paymentMethod === "on-site" ? ... : null` → `amountDueEur: null`.
- Quitar `if (paymentMethod === "on-site") return { kind: "on-site" };`.
- En el `fetch` del checkout añadir `paymentMode: draft.paymentMode` al body.
- En el insert de respaldo (`:229-261`) `price_eur: draft.tierPriceOnline ?? draft.tierPrice` y `payment_mode: draft.paymentMode`.
- `saveDetailsStep` pasa `paymentMode` a `updateDraftBookingMeta` (en lugar de `paymentMethod`).
- Renombrar `draft.paymentMethod` → `draft.paymentMode` en el reducer/estado del flujo (grep `paymentMethod` en `app/components/sections/booking/` y `app/types/`).

**Step 9: Verificar**

Run: `bun run build && grep -rn "on-site\|payOnSite\|paymentMethod" app/components/sections/booking app/types app/actions | grep -v requested`
Expected: compila; el grep solo devuelve la página `requested` si queda `payment=on-site` como legado.

**Step 10: Commit**

```bash
git add -A app/components/sections/booking app/types messages app/actions/booking-draft.ts
git commit -m "feat(booking): pay a deposit or the full price to book"
```

## Tarea 1.8 — Dashboard: ver lo pagado y cobrar el saldo

**Files:**
- Modify: `app/types/booking.ts:6` (`PaymentStatus`), `app/(dashboard)/dashboard/bookings/[id]/types.ts`, `app/(dashboard)/dashboard/bookings/[id]/page.tsx:131` (select)
- Modify: `app/(dashboard)/dashboard/bookings/[id]/booking-detail-sections.tsx:37-42` (badges) y `:135-148` (celda de pago)
- Create: `app/actions/booking-payment.ts`
- Create: `app/(dashboard)/dashboard/bookings/[id]/settle-balance-dialog.tsx`
- Modify: `messages/{en,es}/dashboard.json`

**Step 1: Tipos**

```ts
export type PaymentStatus = "pending" | "deposit_paid" | "paid" | "failed" | "refunded";
export type PaymentMode = "deposit" | "full" | "bonus" | "none";
export type BalanceMethod = "cash" | "card" | "transfer" | "other";
```

`BookingDetail` (`[id]/types.ts`) gana `payment_mode: PaymentMode | null; amount_paid_eur: number | null; balance_settled_at: string | null; balance_settled_method: BalanceMethod | null;`. Añadir las cuatro columnas al `select` de `[id]/page.tsx:131`.

**Step 2: Server Action**

```ts
"use server";

import { requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { recordBookingEvent } from "@/lib/booking-events/record";
import { amountOwed, paymentStatusAfter } from "@/lib/payments/amounts";
import { formatPrice } from "@/utils/format";
import type { BalanceMethod } from "@/types/booking";

const METHODS: BalanceMethod[] = ["cash", "card", "transfer", "other"];

/**
 * Money taken at the counter: the balance of a deposit, a cash deposit on a
 * booking made by phone, or the whole price. Adds to `amount_paid_eur` and
 * moves `payment_status` forward; it never lowers either.
 */
export async function recordCounterPayment(
  accessToken: string | null,
  input: { bookingId: string; amountEur: number; method: BalanceMethod },
): Promise<{ error: string | null }> {
  const { userId, role } = await requireRole(accessToken);
  if (!METHODS.includes(input.method)) return { error: "invalid_method" };
  if (!Number.isFinite(input.amountEur) || input.amountEur <= 0) return { error: "invalid_amount" };

  const db = getAdminClient().database;
  const { data } = await db
    .from("bookings")
    .select("price_eur, amount_paid_eur, payment_status")
    .eq("id", input.bookingId)
    .maybeSingle();
  const row = data as { price_eur: number | string | null; amount_paid_eur: number | string | null; payment_status: string } | null;
  if (!row) return { error: "not_found" };

  const price = Number(row.price_eur ?? 0);
  const paid = Number(row.amount_paid_eur ?? 0) + input.amountEur;
  const status = paymentStatusAfter(paid, price);
  const owed = amountOwed(price, paid);

  const { error } = await db
    .from("bookings")
    .update({
      amount_paid_eur: paid,
      payment_status: status,
      ...(owed === 0 ? { balance_settled_at: new Date().toISOString(), balance_settled_method: input.method } : {}),
    })
    .eq("id", input.bookingId);
  if (error) return { error: error.message };

  await recordBookingEvent({
    bookingId: input.bookingId,
    channel: "payment",
    event: "paid",
    actorId: userId,
    actorRole: role,
    summary: `Cobrado en el centro · ${formatPrice(input.amountEur, "es")} (${input.method})` + (owed > 0 ? ` · pendiente ${formatPrice(owed, "es")}` : ""),
    payload: { amountEur: input.amountEur, method: input.method, owedEur: owed },
  });
  return { error: null };
}
```

**Step 3: Celda de pago en `MetaStrip`**

Sustituir la celda de pago (`:135-148`) por una que muestre el badge **y debajo** `Pagado {amount_paid_eur} · Pendiente {amountOwed(price_eur, amount_paid_eur)}` y, si `owed > 0` y `status !== "cancelled"`, un botón pequeño `t("payment.settle")` que abre `SettleBalanceDialog`. Añadir `deposit_paid: "bg-amber-100 text-amber-800"` a `paymentBadgeClasses`.

**Step 4: Diálogo**

`settle-balance-dialog.tsx`: overlay copiado de `calendar-filters-modal.tsx`. Campos: importe (prefijado con lo pendiente, editable), método (`OptionSelect` con `cash|card|transfer|other`). Al confirmar llama a `recordCounterPayment(getAccessToken(), {...})`, luego `router.refresh()`. Estado `saving` y error.

**Step 5: i18n** (`dashboard.bookings`)

```json
"paymentStatus": { "deposit_paid": "Depósito pagado" },
"detail": {
  "payment": {
    "paid": "Pagado",
    "owed": "Pendiente",
    "settle": "Cobrar saldo",
    "mode": { "deposit": "Depósito online", "full": "Pago completo online", "bonus": "Bono", "none": "Sin pago" },
    "dialog": {
      "title": "Cobrar en el centro",
      "amount": "Importe",
      "method": "Método",
      "methods": { "cash": "Efectivo", "card": "Tarjeta", "transfer": "Transferencia", "other": "Otro" },
      "confirm": "Registrar cobro",
      "cancel": "Cancelar"
    }
  }
}
```

EN: "Deposit paid", "Paid", "Owed", "Collect balance", "Online deposit", "Paid in full online", "Voucher", "No payment", "Collect at the centre", "Amount", "Method", "Cash", "Card", "Bank transfer", "Other", "Record payment", "Cancel".

También `dashboard.transactions.status.deposit_paid` ("Depósito" / "Deposit").

**Step 6: Verificar**

Run: `bun run build`. Abrir una reserva con `deposit_paid`, pulsar "Cobrar saldo", confirmar: badge pasa a "Pagada", historial muestra "Cobrado en el centro".

**Step 7: Commit**

```bash
git add -A app/actions/booking-payment.ts "app/(dashboard)/dashboard/bookings/[id]" app/types/booking.ts messages
git commit -m "feat(dashboard): show what was paid and collect the balance"
```

## Tarea 1.9 — Reservas manuales: sección "Pago"

**Files:**
- Modify: `app/(dashboard)/dashboard/bookings/new/form-state.ts`, `.../new/page.tsx`, `.../new/create-booking.ts:161-185`
- Create: `app/(dashboard)/dashboard/bookings/_shared/payment-fields.tsx`
- Modify: `app/(dashboard)/dashboard/bookings/[id]/edit/form-state.ts`, `.../edit/form-sections.tsx`, `.../edit/save-booking.ts`, `app/types/booking.ts` (`UpdateBookingPayload`)

**Step 1: Estado**

`form-state.ts` (new): añadir `paymentStatus: "pending" | "deposit_paid" | "paid"; amountPaid: string; paymentMethod: BalanceMethod | "";` con acciones `SET_PAYMENT_STATUS`, `SET_AMOUNT_PAID`, `SET_PAYMENT_METHOD`. Valores iniciales `"pending"`, `""`, `""`.

**Step 2: Componente compartido** `payment-fields.tsx`

Tres controles: `OptionSelect` de estado (pending / deposit_paid / paid, etiquetas de `dashboard.bookings.paymentStatus`), input numérico de importe cobrado (se deshabilita en `pending`; al elegir `paid` se rellena con el precio del tier si está vacío), `OptionSelect` de método (se muestra si estado ≠ pending). Props: `value`, `price`, `onChange`.

**Step 3: Insertar en `create-booking.ts`**

Después de `price_eur`, añadir:

```ts
      payment_status: draft.paymentStatus,
      payment_mode: draft.paymentStatus === "pending" ? "none" : draft.paymentStatus === "paid" ? "full" : "deposit",
      amount_paid_eur: draft.paymentStatus === "pending" ? 0 : Number(draft.amountPaid || 0),
      ...(draft.paymentStatus === "paid" && draft.paymentMethod
        ? { balance_settled_at: new Date().toISOString(), balance_settled_method: draft.paymentMethod }
        : {}),
```

Si `amount_paid_eur > 0`, tras `recordBookingCreated` llamar a `recordCounterPayment` **no**: eso sumaría dos veces. En su lugar registrar un evento `payment/paid` directo con `recordBookingEvent` desde una nueva Server Action `recordBookingPaymentNote` (misma firma que `recordBookingCreated` en `app/actions/booking-draft.ts:314`, añadir ahí). Resumen: `Cobrado al crear · X € (método)`.

**Step 4: Edición**

`UpdateBookingPayload` gana `payment_status?, amount_paid_eur?, balance_settled_at?, balance_settled_method?`. La RPC ya los acepta desde la Tarea 1.1. En `form-sections.tsx` añadir `<PaymentFields>` en una tarjeta "Pago". En `save-booking.ts` mapear. **Importante:** `save-booking.ts` recalcula `price_eur` desde el tier en cada guardado; cambiar para que solo lo recalcule si cambió el tier o la ubicación (comparar con el valor cargado), si no, conservar el precio guardado (puede llevar descuento).

**Step 5: Verificar**

Run: `bun run build`. Crear reserva manual con "Depósito pagado · 50 € · efectivo": el detalle muestra Pagado 50, Pendiente 50, historial "Cobrado al crear".

**Step 6: Commit**

```bash
git add -A "app/(dashboard)/dashboard/bookings" app/types/booking.ts app/actions/booking-draft.ts messages
git commit -m "feat(dashboard): record counter payments on manual bookings"
```

## Tarea 1.10 — Transacciones y calendario

**Files:**
- Modify: `app/(dashboard)/dashboard/transactions/page.tsx:460` (select), `:502-508` (status), `:605-607` (revenue)
- Modify: `app/(dashboard)/dashboard/contacts/[id]/history-sections.tsx:70-76`, `:142-144`
- Modify: `app/lib/calendar-event.ts:88-93`, `:121`

**Step 1: Transacciones**

- Select añade `amount_paid_eur, payment_mode`.
- `amount` de la fila = `amount_paid_eur` (lo cobrado), y añadir `listAmount = price_eur` para mostrar "50 / 100 €" en la lista.
- `status`: `payment_status === "paid"` → `completed`; `deposit_paid` → `deposit_paid`; `failed|refunded` → tal cual; resto → `pending`. **Deja de contar como ingreso una reserva confirmada sin pagar.**
- Revenue = suma de `amount_paid_eur`. Tarjeta "Pendiente" = suma de `amountOwed(price_eur, amount_paid_eur)` de reservas no canceladas.

**Step 2: Ficha de contacto**

`paidTotal` = suma de `amount_paid_eur`. Añadir `amount_paid_eur` al select de `app/actions/contacts.ts:116` y al tipo `ContactBooking`. Usar `t("transactions.paidToDate")` en vez del literal "Paid to date" de la línea 151.

**Step 3: Calendario**

`PAYMENT_LABELS` añade `deposit_paid: "Depósito pagado"`; select de `:121` añade `amount_paid_eur`; línea `Pago:` añade ` (pagado X € · pendiente Y €)` cuando `amount_paid_eur` existe.

**Step 4: Verificar + commit**

```bash
bun run build
git add -A "app/(dashboard)/dashboard/transactions" "app/(dashboard)/dashboard/contacts" app/lib/calendar-event.ts app/actions/contacts.ts app/types/contact.ts
git commit -m "feat(dashboard): revenue counts money received, not bookings confirmed"
```

## Tarea 1.11 — Ajustes → Pagos

**Files:**
- Modify: `app/(dashboard)/dashboard/settings/settings-tabs.tsx:10-12`
- Create: `app/components/dashboard/settings/payments-settings.tsx`
- Modify: `messages/{en,es}/dashboard.json` (`settings.payments`; ya existen `subtitle`, `testEnvironment`… sin uso: reutilizar `subtitle`)

**Step 1:** añadir tab `payments` (solo admin, la página ya lo es). Componente cliente: carga con `getPublicPaymentSettings()`, tres campos (`depositPercent` número 10–100, `fullPaymentDiscountPercent` 0–50, `requirePayment` toggle con `ToggleRow` ya existente en la ficha de contacto), guarda con `savePaymentSettings(getAccessToken(), value)`. Textos ES: "Pagos", "Depósito al reservar (%)", "Descuento por pagar el 100% (%)", "Exigir pago para reservar", "Guardar". EN equivalentes.

**Step 2:** `bun run build`; cambiar el descuento a 0 y comprobar que el formulario público deja de mostrar "−5%".

**Step 3:**

```bash
git add -A "app/(dashboard)/dashboard/settings" app/components/dashboard/settings/payments-settings.tsx messages
git commit -m "feat(settings): deposit and full-payment discount are editable"
```

## Tarea 1.12 — Reactivar `/booking` (solo cuando el centro dé la fecha)

**Files:**
- Modify: `app/(site)/[locale]/(page)/booking/page.tsx` (seguir el TODO del fichero)
- Modify: `app/lib/sitemap-data.ts:134-135`
- Modify: `app/components/header.tsx:800-804`, `app/components/sections/home/hero.tsx:296-304`, `app/components/sections/wellness/treatment/treatment-section.tsx:142-145, 230-233, 309-312`, `app/components/sections/wellness/treatment/service-detail-view.tsx:23-27`
- Modify: `app/api/[transport]/route.ts:164` — **no** restaurar `create_booking` (crearía reservas sin pago).

Pasos: restaurar `<BookingSection />`, volver a meter `/booking` en el sitemap, reactivar CTAs con `href`. `bun run build`. Commit `feat(site): public booking is back behind a deposit`. **Desplegar solo cuando el centro confirme el día de apertura de agenda.** Hasta entonces, mergear sin desplegar o dejar en rama `feat/reopen-booking`.

---

# FASE 2 — Ficha de contacto y atajos del día a día

## Tarea 2.1 — Buscar contactos por nombre

**Files:**
- Modify: `app/actions/contacts.ts:29-78` (`fetchContacts`)
- Modify: `app/(dashboard)/dashboard/users/page.tsx` (`FilterModal`, etiqueta del input)
- Modify: `messages/{en,es}/dashboard.json` → `users.filters.email` (o la clave que use el input; grep "email" en `users.filters`)

**Step 1:** en `fetchContacts`, renombrar el parámetro `email` a `search` y sustituir `query.ilike("email", \`*${term}*\`)` por la técnica de `searchContactsForCampaign` (`app/actions/campaigns.ts:671`): limpiar `,()*` y `query.or(\`email.ilike.*${term}*,first_name.ilike.*${term}*,last_name.ilike.*${term}*\`)`. Mantener el nombre del parámetro en las llamadas de `users/page.tsx`.

**Step 2:** etiqueta del campo → "Nombre o email" / "Name or email".

**Step 3:** `bun run build`; buscar "Fiona" en `/dashboard/users` devuelve la ficha.

**Step 4:** commit `feat(contacts): search by name as well as email`.

## Tarea 2.2 — Pestañas: "Detalles" primero

**Files:**
- Modify: `app/(dashboard)/dashboard/contacts/[id]/page.tsx:37-38, 128-151, 312-427`
- Modify: `app/(dashboard)/dashboard/contacts/[id]/contact-details-card.tsx:54` (quitar el `<h2>Details</h2>` literal)
- Modify: `messages/{en,es}/dashboard.json` → `contacts.detail.details.heading` ("Detalles" / "Details"), `contacts.detail.consent.heading` ("Consentimiento" / "Consent"), `contacts.detail.bonuses.heading` ("Bonos" / "Vouchers")

**Step 1:** `type HistoryTab = "details" | "consent" | "bonuses" | "bookings" | "transactions" | "races" | "education" | "campaigns";` y estado inicial `"details"`.

**Step 2:** `historyTabs` en ese orden. `consent` y `bonuses` sin contador por ahora (las fases 3 y 4 los rellenan) y renderizan un placeholder `<p className="text-petroleum-400 text-sm">{t("comingSoon")}</p>` usando `dashboard.common.comingSoon` si existe (si no, crearla).

**Step 3:** mover el `<form>` con `<ContactDetailsCard>` **dentro** de la tarjeta de pestañas, como contenido de `tab === "details"`. La cabecera con título, Eliminar y Guardar queda fuera, arriba, y Guardar sigue siendo `type="submit"` del formulario: para que funcione desde fuera, dar `id="contact-form"` al `<form>` y `form="contact-form"` al botón.

**Step 4:** `bun run build`; la ficha abre en Detalles; Guardar sigue guardando.

**Step 5:** commit `feat(contacts): the contact file opens on a details tab`.

## Tarea 2.3 — "Nueva reserva" desde la ficha

**Files:**
- Modify: `app/(dashboard)/dashboard/contacts/[id]/history-sections.tsx` (`BookingsSection`: botón arriba a la derecha)
- Modify: `app/(dashboard)/dashboard/bookings/new/form-state.ts` (acción `PREFILL_CLIENT`), `.../new/use-new-booking-data.ts:33-49` (leer `?contact=`), `.../new/page.tsx` (pasar el id al hook)
- Modify: `messages/{en,es}/dashboard.json` → `contacts.detail.bookings.new` ("Nueva reserva" / "New booking")

**Step 1:** `BookingsSection` recibe `contactId` y pinta `<Link href={\`/dashboard/bookings/new?contact=${contactId}\`} className={BUTTON_PRIMARY_SMALL}>…`. Buscar la clase de botón pequeño que ya use la página (`grep -n "rounded-full" page.tsx`).

**Step 2:** `form-state.ts`:

```ts
  | { type: "PREFILL_CLIENT"; value: { firstName: string; lastName: string; email: string; phone: string; gender: GenderValue; language: "en" | "es" } }
```

y en el reducer `case "PREFILL_CLIENT": return { ...state, ...action.value };`.

**Step 3:** en `use-new-booking-data.ts`, dentro del `useEffect` de `searchParams`, si hay `contact`, llamar a `fetchContactDetail(getAccessToken(), contactId)` y despachar `PREFILL_CLIENT` con `contact.first_name ?? ""`, `last_name ?? ""`, `email ?? ""`, `phone ?? ""`, `gender ?? GENDER_UNSPECIFIED`, `preferred_language === "en" ? "en" : "es"`.

**Step 4:** `bun run build`; desde la ficha, "Nueva reserva" abre el formulario con los datos de la clienta rellenos (se ven al llegar al paso de cliente).

**Step 5:** commit `feat(dashboard): start a booking from the contact file`.

## Tarea 2.4 — Panel lateral en el calendario

**Files:**
- Create: `app/components/dashboard/calendar/event-sheet.tsx`
- Create: `app/actions/booking-peek.ts`
- Modify: `app/(dashboard)/dashboard/page.tsx:73-78` (`handleEventClick`)
- Modify: `app/globals.css:77-111` (añadir `animate-slide-in-right`)
- Modify: `messages/{en,es}/dashboard.json` → `calendar.sheet.*`

**Step 1: Server Action**

```ts
"use server";

import { requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";

export type BookingPeek = { /* NO re-exportar desde aquí: definir en app/types/booking.ts */ };

export async function fetchBookingPeek(accessToken: string | null, bookingId: string) {
  const { role, userId } = await requireRole(accessToken);
  const db = getAdminClient().database;
  let query = db
    .from("bookings")
    .select("id, service_title, date, time, duration, status, payment_status, price_eur, amount_paid_eur, first_name, last_name, email, phone, contact_id, staff_id, notes, service_tiers(label, color)")
    .eq("id", bookingId);
  // A partner only sees their own bookings, as the list page already enforces.
  if (role === "partner") query = query.eq("partner_id", userId);
  const { data } = await query.maybeSingle();
  return data ?? null;
}
```

Definir el tipo `BookingPeek` en `app/types/booking.ts`.

**Step 2: Panel**

`event-sheet.tsx`: `fixed inset-0 z-50` con backdrop `bg-black/40` y un `<aside>` a la derecha `w-full max-w-md bg-sand-100 h-full` con `animate-slide-in-right`. Props `{ bookingId: string | null; onClose: () => void }`. Carga con `fetchBookingPeek`. Muestra: servicio + tipo de sesión (color), fecha/hora/duración, estado y pago (reutilizar `paymentBadgeClasses` exportándolo desde `booking-detail-sections.tsx` o duplicando 5 líneas), cliente (nombre, teléfono, email), notas. Tres enlaces: `t("viewBooking")` → `/dashboard/bookings/${id}`, `t("editBooking")` → `/dashboard/bookings/${id}/edit`, y si `contact_id` `t("viewContact")` → `/dashboard/contacts/${contact_id}`. Escape y clic fuera cierran (copiar de `calendar-filters-modal.tsx`).

**Step 3:** `handleEventClick`: si `event.type === "booking"` → `setSheetBookingId(event.id)`; otros tipos siguen con `push`. Renderizar `<EventSheet bookingId={sheetBookingId} onClose={() => setSheetBookingId(null)} />`.

**Step 4:** i18n `calendar.sheet`: `viewBooking` "Ver reserva"/"Open booking", `editBooking` "Editar"/"Edit", `viewContact` "Ver ficha del cliente"/"View contact", `client` "Cliente"/"Client", `notes` "Notas"/"Notes".

**Step 5:** `bun run build`; clic en una cita del Resumen abre el panel; los tres enlaces funcionan.

**Step 6:** commit `feat(dashboard): a side sheet opens a booking from the calendar`.

---

# FASE 3 — Bonos

## Decisiones

| Decisión | Elegido | Por qué |
|---|---|---|
| Modelo | `bonus_plans` (plantilla por tipo de sesión) + `contact_bonuses` (un bono comprado) + `bookings.bonus_id`. | Es lo que describió el centro: definir el bono una vez, asignarlo a la clienta, descontar por reserva. |
| Sesiones consumidas | Se **cuentan** desde `bookings` con `bonus_id` y estado `pending\|confirmed\|completed`. No hay contador. | Cancelar una reserva devuelve la sesión sin lógica extra; es exactamente lo que pidieron. |
| Pago de una reserva con bono | `payment_mode = 'bonus'`, `payment_status = 'paid'`, `amount_paid_eur = 0`, `price_eur` = precio de lista (informativo). | El bono ya se pagó; la reserva no suma ingresos. El ingreso es la compra del bono. |
| Venta en la web | Columna `sell_online` creada pero **sin UI pública en esta versión**. | El centro lo quiere "el día de mañana". |
| RLS | Ambas tablas con RLS y sin políticas: solo service key. | Igual que campañas. |

## Tarea 3.1 — Migración

**Files:**
- Create: `insforge/migrations/20261103_bonuses.sql`

```sql
CREATE TABLE IF NOT EXISTS bonus_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES service_tiers(id) ON DELETE CASCADE,
  name text NOT NULL,
  sessions integer NOT NULL CHECK (sessions BETWEEN 1 AND 50),
  price_eur numeric(10,2) NOT NULL CHECK (price_eur >= 0),
  validity_days integer NOT NULL DEFAULT 180 CHECK (validity_days BETWEEN 1 AND 1095),
  active boolean NOT NULL DEFAULT true,
  sell_online boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES bonus_plans(id) ON DELETE SET NULL,
  tier_id uuid NOT NULL REFERENCES service_tiers(id) ON DELETE RESTRICT,
  name text NOT NULL,
  sessions_total integer NOT NULL CHECK (sessions_total BETWEEN 1 AND 50),
  price_eur numeric(10,2) NOT NULL,
  paid_method text CHECK (paid_method IS NULL OR paid_method IN ('cash','card','transfer','online','other')),
  purchased_at date NOT NULL DEFAULT CURRENT_DATE,
  expires_at date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_bonuses_contact_idx ON contact_bonuses (contact_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonus_id uuid REFERENCES contact_bonuses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bookings_bonus_idx ON bookings (bonus_id) WHERE bonus_id IS NOT NULL;

ALTER TABLE bonus_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_bonuses ENABLE ROW LEVEL SECURITY;

-- Bonos reales según la carta del centro (2026-11-03): 5 sesiones 450 € (90 €/sesión),
-- 10 sesiones 800 € (80 €/sesión). Cada sesión es una zona. Validez: 180 días (no fijada
-- por el centro; editable desde Ajustes → Bonos).
INSERT INTO bonus_plans (tier_id, name, sessions, price_eur, validity_days)
SELECT id, 'Bono 5 sesiones de drenaje', 5, 450, 180 FROM service_tiers WHERE id = '59d57d59-7b9b-4e32-83fe-c144ec7e8a24'
ON CONFLICT DO NOTHING;
INSERT INTO bonus_plans (tier_id, name, sessions, price_eur, validity_days)
SELECT id, 'Bono 10 sesiones de drenaje', 10, 800, 180 FROM service_tiers WHERE id = '59d57d59-7b9b-4e32-83fe-c144ec7e8a24'
ON CONFLICT DO NOTHING;
```

Aplicar y verificar (`select * from bonus_plans`). Commit `feat(db): bonus plans and contact bonuses`.

## Tarea 3.2 — Módulo puro: saldo de un bono

**Files:**
- Create: `app/lib/bonuses/balance.ts`, `app/lib/bonuses/balance.test.ts`

**Test:**

```ts
import { describe, expect, it } from "bun:test";
import { bonusBalance, usableBonus, type BonusRow, type BonusUse } from "./balance";

const bonus: BonusRow = { id: "b1", tierId: "t1", sessionsTotal: 5, expiresAt: "2027-05-01" };
const use = (status: string): BonusUse => ({ bonusId: "b1", status });

describe("bonusBalance", () => {
  it("counts pending, confirmed and completed bookings as used", () => {
    expect(bonusBalance(bonus, [use("confirmed"), use("pending"), use("completed")]).used).toBe(3);
  });
  it("ignores cancelled and draft bookings", () => {
    expect(bonusBalance(bonus, [use("cancelled"), use("draft")]).used).toBe(0);
  });
  it("remaining never goes below zero", () => {
    expect(bonusBalance(bonus, Array(7).fill(use("confirmed"))).remaining).toBe(0);
  });
});

describe("usableBonus", () => {
  const today = "2026-12-01";
  it("picks the bonus for the tier with sessions left and not expired", () => {
    expect(usableBonus([bonus], [], "t1", today)?.id).toBe("b1");
  });
  it("refuses an expired bonus", () => {
    expect(usableBonus([{ ...bonus, expiresAt: "2026-11-30" }], [], "t1", today)).toBeNull();
  });
  it("refuses a bonus for another tier", () => {
    expect(usableBonus([bonus], [], "t2", today)).toBeNull();
  });
  it("prefers the one expiring first", () => {
    const later = { ...bonus, id: "b2", expiresAt: "2027-12-01" };
    expect(usableBonus([later, bonus], [], "t1", today)?.id).toBe("b1");
  });
});
```

**Implementación:**

```ts
export type BonusRow = { id: string; tierId: string; sessionsTotal: number; expiresAt: string };
export type BonusUse = { bonusId: string; status: string };

const USES_SESSION = new Set(["pending", "confirmed", "completed"]);

export function bonusBalance(bonus: BonusRow, uses: BonusUse[]) {
  const used = uses.filter((u) => u.bonusId === bonus.id && USES_SESSION.has(u.status)).length;
  return { used, remaining: Math.max(0, bonus.sessionsTotal - used) };
}

/** The bonus a new booking for `tierId` should draw from, or null. */
export function usableBonus(bonuses: BonusRow[], uses: BonusUse[], tierId: string, today: string): BonusRow | null {
  return (
    bonuses
      .filter((b) => b.tierId === tierId && b.expiresAt >= today && bonusBalance(b, uses).remaining > 0)
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0] ?? null
  );
}
```

`bun test app/lib/bonuses` → PASS. Commit `feat(bonuses): pure balance rules`.

## Tarea 3.3 — Server Actions

**Files:**
- Create: `app/actions/bonuses.ts`
- Create: `app/types/bonus.ts` (tipos `BonusPlan`, `ContactBonus` con `used`/`remaining`)

Funciones (todas con `requireRole`; las de planes con `ADMIN_ROLES`):

- `fetchBonusPlans(token)` → todos los planes con `service_tiers(label, service_id)`.
- `upsertBonusPlan(token, input)` → valida con Zod (`bonusPlanSchema` en `app/lib/schemas.ts`: `tierId uuid, name 1..80, sessions int 1..50, priceEur ≥0, validityDays int 1..1095, active bool, sellOnline bool`).
- `fetchContactBonuses(token, contactId)` → bonos del contacto + `bookings(id, date, status)` con ese `bonus_id`, devolviendo `used/remaining` calculados con `bonusBalance`.
- `grantContactBonus(token, { contactId, planId, paidMethod, notes })` → copia `name, sessions, price_eur, tier_id` del plan, `expires_at = today + validity_days`, `created_by = userId`. Luego inserta en `booking_events` un evento con `booking_id = null`? **No**: `booking_events` exige `booking_id` nullable pero el historial de la ficha lee por reserva. En su lugar, la pestaña Bonos muestra la lista de bonos con fecha de compra, que es lo que el centro quería ver "abajo".
- `assignBookingBonus(token, { bookingId, bonusId })` → comprueba `usableBonus`, luego `update bookings set bonus_id, payment_mode='bonus', payment_status='paid', amount_paid_eur=0` y `recordBookingEvent({ channel:"system", event:"edited", summary: "Sesión descontada del bono «X» (n/N)" })`.
- `clearBookingBonus(token, bookingId)` → `bonus_id = null, payment_mode = 'none', payment_status = 'pending'` + evento.

Commit `feat(bonuses): plans, grants and booking assignment actions`.

## Tarea 3.4 — Ajustes → Bonos (planes)

**Files:**
- Modify: `app/(dashboard)/dashboard/settings/settings-tabs.tsx`
- Create: `app/components/dashboard/settings/bonus-plans-settings.tsx`, `bonus-plan-modal.tsx`
- Modify: `messages/{en,es}/dashboard.json` → `settings.bonuses.*`

Lista de planes (nombre, tipo de sesión, sesiones, precio, validez, activo, venta online) + botón "Nuevo bono" que abre el modal (copiar estructura de `tier-modal.tsx`; `TierPicker` o `OptionSelect` de tiers activos). Guardar con `upsertBonusPlan`. Textos ES: "Bonos", "Nuevo bono", "Nombre", "Tipo de sesión", "Sesiones", "Precio", "Validez (días)", "Activo", "Vender en la web", "Guardar". EN equivalentes.

`bun run build`; crear un bono de prueba. Commit `feat(settings): bonus plans are managed from settings`.

## Tarea 3.5 — Pestaña Bonos en la ficha

**Files:**
- Create: `app/(dashboard)/dashboard/contacts/[id]/bonuses-section.tsx`, `grant-bonus-dialog.tsx`
- Modify: `app/(dashboard)/dashboard/contacts/[id]/page.tsx` (cargar `fetchContactBonuses` en el reducer de carga; contador de la pestaña = bonos con `remaining > 0`)

`BonusesSection`: por bono una tarjeta con nombre, tipo de sesión, **"3 de 5 usadas · quedan 2"**, barra de progreso, caduca el DD/MM/AAAA (rojo si pasó), comprado el, método de pago, y debajo las reservas que lo consumieron (fecha + estado, enlace a la reserva). Botón "Añadir bono" → `GrantBonusDialog` (plan `OptionSelect` de planes activos, método de pago, notas) → `grantContactBonus` → recargar.

i18n `contacts.detail.bonuses`: `heading`, `add` "Añadir bono", `empty` "Sin bonos", `used` "{used} de {total} usadas", `remaining` "quedan {n}", `expires` "Caduca el {date}", `expired` "Caducado", `purchased` "Comprado el {date}", `dialog.{title,plan,method,notes,confirm,cancel}`.

Commit `feat(contacts): bonuses tab with sessions used and left`.

## Tarea 3.6 — Usar el bono al reservar

**Files:**
- Modify: `app/(dashboard)/dashboard/bookings/new/use-new-booking-data.ts` (si hay `?contact=`, cargar `fetchContactBonuses`), `.../new/form-state.ts` (`bonusId: string | null`, acción `SET_BONUS`), `.../new/page.tsx` (tras elegir tier, si `usableBonus(...)` devuelve uno, mostrar un `ToggleRow` "Usar bono «X» (quedan N)" marcado por defecto), `.../new/create-booking.ts` (si `bonusId`: `bonus_id`, `payment_mode: "bonus"`, `payment_status: "paid"`, `amount_paid_eur: 0`; y ocultar `PaymentFields`)
- Modify: `app/(dashboard)/dashboard/bookings/[id]/booking-detail-sections.tsx` — en la celda de pago, si `payment_mode === "bonus"`, mostrar "Bono" en vez de importes, y un botón "Quitar bono" → `clearBookingBonus`. Si no tiene bono y el contacto tiene uno usable para el tier, botón "Usar bono" → `assignBookingBonus`.
- Modify: `app/(dashboard)/dashboard/bookings/[id]/page.tsx:131` select añade `bonus_id, contact_id`; cargar `fetchContactBonuses` si hay `contact_id`.

Flujo del centro que esto cubre: Fiona termina su drenaje (reserva ya pagada), compra un bono → Ficha → Bonos → Añadir bono. Su próxima reserva desde la ficha ya nace "pagada con bono". Si quiere descontar **la sesión de hoy** del bono recién comprado, en el detalle de esa reserva pulsa "Usar bono".

Commit `feat(bookings): a booking can draw a session from a bonus`.

---

# FASE 4 — Consentimiento informado con firma

> Documento recibido el 2026-11-03 (`Essentia_Consentimiento_Formato_Tabla.docx`). Los campos de abajo son los **definitivos**. El documento tiene además un bloque "Datos personales" (nombre, fecha de nacimiento, teléfono, email) que se rellena desde el contacto y, si falta, se pide; la fecha de nacimiento se guarda en `contacts.birthdate` (ya existe y alimenta la campaña de cumpleaños).

## Decisiones

| Decisión | Elegido | Por qué |
|---|---|---|
| Firma | Canvas con el dedo/ratón, guardada como PNG en un bucket privado `consents`. Firma electrónica simple. | Vale para el móvil y para el iPad del centro, sin coste. Si hace falta firma avanzada, se contrata un proveedor; fuera de alcance. |
| Dónde se rellena | Página pública `/[locale]/consent/[token]` (enlace en el email de confirmación) **y** la misma vista dentro de la pestaña Consentimiento de la ficha, para rellenarlo en el centro. | "Si no lo rellena, lo haces allí". |
| Una vez por clienta | Fila única por `contact_id`; firmado = `signed_at` no nulo. | "Es solo una vez". |
| Imagen | Casilla opcional separada `image_consent`. En el documento es "fotografías del área tratada para documentar su evolución, sin difusión pública"; cualquier uso promocional exige otra autorización. | "No les podemos obligar". |
| Datos de salud (RGPD) | Casilla obligatoria `health_data_consent`. El responsable y el enlace a privacidad salen de la página `/privacy` ya existente (`app/(site)/[locale]/(page)/(legal)/privacy`). | El documento la exige aparte de la aceptación del tratamiento. |
| Firma | Una sola firma cubre tratamiento, datos de salud e imagen (si la marca). | El documento pide dos firmas en papel; en digital, una firma con las casillas marcadas y sellada con fecha vale igual y evita un segundo canvas. |
| Campos | `jsonb data` validado por Zod en servidor. | Cambiar el formulario no exige migración. |

## Tarea 4.1 — Migración y bucket

**Files:**
- Create: `insforge/migrations/20261104_contact_consents.sql`

```sql
CREATE TABLE IF NOT EXISTS contact_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_consent boolean NOT NULL DEFAULT false,
  health_data_consent boolean NOT NULL DEFAULT false,
  signature_path text,
  signed_at timestamptz,
  signed_name text,
  filled_by_role text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contact_consents ENABLE ROW LEVEL SECURITY;
```

Bucket: crear `consents` **privado** desde el panel de Insforge o con el CLI (`npx @insforge/cli@latest storage create-bucket consents --private`; comprobar el comando con `npx @insforge/cli@latest storage --help`). Nada de política pública de lectura.

Commit `feat(db): contact consents`.

## Tarea 4.2 — Campos y schema

**Files:**
- Create: `app/lib/consent/fields.ts`, `app/lib/consent/fields.test.ts`
- Modify: `app/lib/schemas.ts` (`consentSchema`)

```ts
// app/lib/consent/fields.ts
/**
 * The centre's informed-consent form (Essentia_Consentimiento_Formato_Tabla.docx,
 * 2026-11-03), one entry per row of its "Estado de salud" table. Every yes/no is
 * required; the detail is free text the client fills when the answer is yes.
 * Labels live in messages/<locale>/consent.json under `fields.<id>`.
 */
export type ConsentField =
  | { id: string; kind: "boolean"; details?: boolean }
  | { id: string; kind: "text"; maxLength: number };

export const CONSENT_FIELDS: ConsentField[] = [
  { id: "surgery", kind: "boolean", details: true },        // Cirugía o intervención médica (incluida estética)
  { id: "thrombosis", kind: "boolean", details: true },     // Trombosis, embolia o flebitis
  { id: "circulatory", kind: "boolean", details: true },    // Enfermedad circulatoria o cardiovascular
  { id: "heartKidney", kind: "boolean", details: true },    // Insuficiencia cardíaca o enfermedad renal
  { id: "cancer", kind: "boolean", details: true },         // Cáncer, tumor o tratamiento oncológico
  { id: "pregnancy", kind: "boolean", details: true },      // Embarazo o posparto
  { id: "injury", kind: "boolean", details: true },         // Fractura, lesión o herida reciente
  { id: "infection", kind: "boolean", details: true },      // Fiebre, infección o inflamación aguda
  { id: "limbSwelling", kind: "boolean", details: true },   // Hinchazón repentina, dolor o enrojecimiento en una extremidad
  { id: "hypertensionDiabetes", kind: "boolean", details: true }, // Hipertensión no controlada o diabetes
  { id: "medication", kind: "boolean", details: true },     // Medicación relevante (especialmente anticoagulantes)
  { id: "allergies", kind: "boolean", details: true },      // Alergias, afecciones cutáneas o reacción a cosméticos
  { id: "other", kind: "boolean", details: true },          // Otra condición de salud relevante
  { id: "avoidZone", kind: "text", maxLength: 500 },        // Zona que prefiera evitar o que requiera especial cuidado
];

export const REQUIRED_IDS = CONSENT_FIELDS.filter((f) => f.kind === "boolean").map((f) => f.id);

export function missingRequired(data: Record<string, unknown>): string[] {
  return REQUIRED_IDS.filter((id) => typeof data[id] !== "boolean");
}
```

Test: `missingRequired({})` devuelve 13 ids; con los 13 a `false` devuelve `[]`; `{ surgery: "yes" }` sigue faltando `surgery`.

Detalles: se guardan como `data[`${id}Detail`]` (string ≤ 500). Si el booleano es `true` y falta el detalle, el formulario avisa pero no bloquea (el documento en papel tampoco lo exige).

`consentSchema` en `schemas.ts`:

```ts
export const consentSchema = z.object({
  data: z.record(z.string(), z.union([z.boolean(), z.string().max(500)])),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: z.string().min(6).optional(),
  treatmentAccepted: z.literal(true),      // "Acepto el tratamiento informado"
  healthDataConsent: z.literal(true),      // RGPD: tratamiento de datos de salud
  imageConsent: z.boolean(),               // opcional e independiente
  signedName: z.string().min(2).max(120),
  signaturePng: z.string().startsWith("data:image/png;base64,").max(400_000),
});
```

Textos legales a copiar **literalmente** del documento en `consent.json` (ES; traducir a EN con el mismo sentido):

- `treatment.body`: "Declaro que la información facilitada es correcta y comunicaré cualquier cambio relevante antes de futuras sesiones. He recibido información sobre el servicio solicitado, su finalidad de bienestar, posibles molestias transitorias y sus limitaciones. Comprendo que no sustituye la atención médica y que puedo solicitar la interrupción del tratamiento en cualquier momento. Consiento voluntariamente su realización."
- `treatment.accept`: "Acepto el tratamiento informado."
- `healthData.accept`: "Consiento expresamente el tratamiento de los datos de salud facilitados para valorar la adecuación y seguridad del servicio, según la información de privacidad disponible." + enlace "Información completa" a `/privacy` (`/es/privacidad` o la ruta que use `app/(site)/[locale]/(page)/(legal)/privacy`). El responsable (razón social y contacto) se toma de esa misma página de privacidad; si no figura, pedirlo al centro.
- `image.body`: "Autorizo fotografías del área tratada para documentar su evolución, sin difusión pública. Cualquier publicación o uso promocional requerirá una autorización específica adicional."
- `image.yes` "Sí autorizo" / `image.no` "No autorizo".
- `health.intro`: "Indique si presenta actualmente o ha presentado alguna de las siguientes condiciones. Cuando corresponda, especifique cuál y desde cuándo."
- `fields.<id>` con las 13 etiquetas del comentario de arriba, y `fields.<id>Detail` con la pista de detalle del documento ("Tipo, zona y fecha", "Tipo y fecha", "Cuál", "Tipo y fecha/tratamiento", "Semanas de gestación / fecha del parto", "Zona y fecha", "Detalle").

Commit `feat(consent): provisional field list and schema`.

## Tarea 4.3 — Componente de firma

**Files:**
- Create: `app/components/ui/signature-pad.tsx`

Canvas `width 600 height 200` escalado por `devicePixelRatio`, eventos `pointerdown/move/up` con `setPointerCapture`, `touch-action: none`, botón "Borrar". Expone `onChange(dataUrl | null)`; vacío si no se ha dibujado. Sin dependencias.

Commit `feat(ui): signature pad`.

## Tarea 4.4 — Página pública y acción

**Files:**
- Create: `app/(site)/[locale]/(page)/consent/[token]/page.tsx` (server: carga el consentimiento por token con `getAdminClient`; si `signed_at` → vista "ya firmado"; si no → `<ConsentForm token mode="client" />`)
- Create: `app/components/sections/consent/consent-form.tsx` (cliente; usa `CONSENT_FIELDS`, `SignaturePad`, casilla de imagen, nombre, aceptación)
- Create: `app/actions/consent.ts` → `submitConsent(token, input)` (pública, sin rol: el token es el secreto) y `createConsentLink(accessToken, contactId)` (dashboard; crea la fila si no existe y devuelve la URL)
- Create: `messages/{en,es}/consent.json` y **añadir `"consent"` a `namespaces` en `i18n/request.ts`** (reiniciar `bun run dev`)
- Modify: `app/lib/sitemap-data.ts` — no incluir `/consent`; `robots`: `noindex` vía `generateMetadata` `{ robots: { index: false } }`.

`submitConsent`: validar con `consentSchema` + `missingRequired(data).length === 0`; decodificar el PNG (`Buffer.from(base64, "base64")`, rechazar > 300 KB), subir con `getAdminClient().storage.from("consents").upload(\`${contactId}/${Date.now()}.png\`, blob)`, `update contact_consents set data, image_consent, health_data_consent, signature_path, signed_at = now(), signed_name, filled_by_role = 'client'`; si llegan `birthdate`/`phone` y el contacto no los tiene, `update contacts`.

Estructura de la página, en el orden del documento: **Datos personales** (nombre y email solo lectura desde el contacto; teléfono y fecha de nacimiento editables si faltan) → **Estado de salud** (tabla de 13 filas Sí/No + detalle, y el campo de zona a evitar) → **Consentimiento del tratamiento** (texto + casilla) → **Datos personales y de salud** (casilla RGPD + enlace) → **Consentimiento de imagen** (Sí/No) → **Nombre y firma** → "Firmar y enviar".

Resto de textos `consent.json` ES (EN equivalentes): `title` "Consentimiento informado", `intro` "Antes de tu primera sesión necesitamos conocer tu estado de salud.", `personal.heading` "Datos personales", `personal.{name,birthdate,phone,email}`, `health.heading` "Estado de salud", `yes`/`no`, `treatment.heading` "Consentimiento del tratamiento", `healthData.heading` "Datos personales y de salud", `image.heading` "Consentimiento de imagen (opcional e independiente)", `signedName` "Nombre y apellidos", `signature` "Firma de la clienta", `clear` "Borrar", `submit` "Firmar y enviar", `done.title` "Gracias", `done.body` "Tu consentimiento queda guardado.", `already` "Este consentimiento ya está firmado."

Commit `feat(consent): clients sign the informed consent from a private link`.

## Tarea 4.5 — Pestaña Consentimiento en la ficha

**Files:**
- Create: `app/(dashboard)/dashboard/contacts/[id]/consent-section.tsx`
- Modify: `app/actions/consent.ts` → `fetchContactConsent(accessToken, contactId)` devuelve `data`, `image_consent`, `signed_at`, `signed_name` y la firma como data URL (descargar con `getAdminClient().storage.from("consents").download(path)` y convertir a base64; si el SDK ofrece `createSignedUrl`, usarlo en su lugar)
- Modify: `page.tsx` de la ficha (cargar; contador de pestaña 1 si firmado)

Vista firmada: tabla de las 13 condiciones con respuesta (sí/no + detalle) **resaltando en ámbar las que están a "Sí"** (es lo que la terapeuta mira antes de entrar en cabina), zona a evitar, casillas de tratamiento/datos/imagen, nombre, fecha, imagen de la firma, botón "Copiar enlace" (por si hay que reenviarlo). Vista sin firmar: botón "Copiar enlace para la clienta" y debajo `<ConsentForm mode="staff" contactId>` para rellenarlo en el centro (misma acción con `filled_by_role = role` a través de una variante autenticada `submitConsentAsStaff(accessToken, contactId, input)`).

i18n `contacts.detail.consent`: `heading`, `signed` "Firmado el {date} por {name}", `unsigned` "Sin firmar", `copyLink` "Copiar enlace", `copied` "Copiado", `fillHere` "Rellenar aquí con la clienta", `image.yes` "Autoriza imágenes", `image.no` "No autoriza imágenes".

Commit `feat(contacts): consent tab shows or collects the signed form`.

## Tarea 4.6 — Enlace en el email de confirmación

**Files:**
- Modify: `app/services/booking-payments.service.ts` (tras el upsert del contacto: si no hay `contact_consents` firmado para ese contacto, `createConsentLink` interno → pasar `consentUrl` a la plantilla)
- Modify: `app/emails/templates/booking-confirmation.ts` (bloque "Antes de tu primera sesión, rellena tu consentimiento informado" con botón, solo si `consentUrl`)
- Modify: `app/actions/booking-notifications.ts` (evento `confirmed` desde el dashboard: mismo bloque)

Commit `feat(emails): the confirmation asks a new client to sign the consent`.

---

# FASE 5 — Automatización post‑visita para clientas nuevas

## Decisiones

| Decisión | Elegido | Por qué |
|---|---|---|
| Canal | **Email**, con el motor de campañas existente. | WhatsApp a clientes exige plantillas aprobadas por Meta y coste por mensaje desde 2026‑10‑01. Email ya funciona y es gratis. Si el centro quiere WhatsApp, es una fase aparte. |
| Trigger nuevo | `first_visit` con `hours` (0–168): dispara cuando la **primera** reserva confirmada del contacto ha terminado hace ≥ N horas. `cycle = ""` → una vez en la vida. | "Que no se envíe cada vez que la clienta venga". |
| Segmento | El filtro de audiencia ya permite "ha reservado el servicio X" → se limita a drenaje. | Sin código nuevo. |
| Dos campañas | (1) instrucciones + vídeo, 0 h; (2) petición de reseña Google, 3 h. | Lo pidieron separadas en el tiempo. |
| Granularidad | Cron cada 15 min → el email sale dentro del cuarto de hora siguiente. | Suficiente. |
| Antigüedad | Solo contactos cuya primera visita es posterior a `activated_at` de la campaña. | Que no se escriba a todas las clientas antiguas al activarla. |

## Tarea 5.1 — Tipo, schema y candidato

**Files:**
- Modify: `app/types/campaign.ts:27-40` (`TriggerEvent` añade `"first_visit"`; `CampaignTrigger` añade `hours?: number`)
- Modify: `app/lib/schemas.ts:415` (`campaignTriggerSchema`: enum + `hours: z.number().int().min(0).max(168).optional()`)
- Modify: `app/lib/campaigns/audience-filter.ts:12-48` (`ContactCandidate` y `Recipient` ganan `firstVisitEndsAt?: string | null` ISO y `confirmedBookingsCount?: number`)
- Modify: `app/lib/campaigns/audience.ts` (`loadCandidates`: el select de bookings añade `time, duration, status`; en el fold, para reservas con `status in ('confirmed','completed')` y `date` y `time`, calcular `endsAt = date + time + parseDurationMinutes(duration)` en `Atlantic/Canary` y quedarse con el **mínimo**; contar `confirmedCount`)
- Modify: `app/lib/campaigns/audience-filter.ts` donde `ContactCandidate` → `Recipient` se proyecta: pasar los dos campos nuevos.

Para construir el ISO: `new Date(\`${date}T${time}:00\`)` interpreta hora local del servidor; usar `zonedTimeToUtc` si `date-fns-tz` está en `package.json` (comprobar), si no, calcular con `Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, ... })` como hace `localDay` en `automation-rules.ts`. Lo importante es comparar en la misma base en el test.

Commit `feat(campaigns): candidates know when their first visit ended`.

## Tarea 5.2 — Regla + test

**Files:**
- Modify: `app/lib/campaigns/automation-rules.ts` (`dueRecipients`: nuevo `case "first_visit"`)
- Modify: `app/lib/campaigns/automation-rules.test.ts`

**Test (añadir al describe existente):**

```ts
describe("first_visit", () => {
  const now = new Date("2026-12-10T17:30:00Z");
  const activatedAt = "2026-12-01T00:00:00Z";
  const r = (over: Partial<Recipient>): Recipient => ({
    id: "c1", email: "a@b.c", firstName: "Ana", language: "es",
    confirmedBookingsCount: 1, firstVisitEndsAt: "2026-12-10T14:00:00Z", ...over,
  });

  it("fires once the first visit ended at least `hours` ago", () => {
    const due = dueRecipients({ trigger: { event: "first_visit", hours: 3 }, recipients: [r({})], activatedAt, now });
    expect(due).toEqual([{ recipient: r({}), cycle: "" }]);
  });
  it("waits while the delay has not elapsed", () => {
    expect(dueRecipients({ trigger: { event: "first_visit", hours: 4 }, recipients: [r({})], activatedAt, now })).toEqual([]);
  });
  it("ignores clients whose first visit predates the campaign", () => {
    expect(dueRecipients({ trigger: { event: "first_visit", hours: 0 }, recipients: [r({ firstVisitEndsAt: "2026-11-20T10:00:00Z" })], activatedAt, now })).toEqual([]);
  });
  it("ignores contacts with no confirmed visit", () => {
    expect(dueRecipients({ trigger: { event: "first_visit", hours: 0 }, recipients: [r({ firstVisitEndsAt: null, confirmedBookingsCount: 0 })], activatedAt, now })).toEqual([]);
  });
});
```

**Regla:**

```ts
    // Once in a lifetime, N hours after the end of the first confirmed visit.
    // Older first visits are left alone: switching the campaign on must not
    // write to everyone who ever came.
    case "first_visit": {
      const delayMs = (trigger.hours ?? 0) * 3_600_000;
      return recipients
        .filter((r) => {
          if (!r.firstVisitEndsAt) return false;
          const ends = Date.parse(r.firstVisitEndsAt);
          return ends >= Date.parse(activatedAt) && ends + delayMs <= now.getTime();
        })
        .map((recipient) => ({ recipient, cycle: "" }));
    }
```

`bun test app/lib/campaigns` → PASS. Commit `feat(campaigns): first_visit trigger fires once, hours after the visit`.

## Tarea 5.3 — Editor del trigger e i18n

**Files:**
- Modify: `app/(dashboard)/dashboard/campaigns/_form/trigger-step.tsx:12-15` (`automated: ["segment_entry", "after_booking", "first_visit"]`), y junto al input de días (`:80-117`) un input de horas `id="campaign-trigger-hours"` `min 0 max 168` visible cuando `event === "first_visit"`; al elegirlo, `hours: trigger.hours ?? 0`.
- Modify: resúmenes en `campaign-form.tsx:299-304`, `review-step.tsx:197`, `[id]/page.tsx:209` (añadir caso `first_visit` → `t("hoursAfterFirstVisit", { hours })`).
- Modify: `messages/{en,es}/dashboard.json` → `campaigns.trigger.event.first_visit` "Tras la primera visita" / "After the first visit"; `eventDesc.first_visit` "Una sola vez, N horas después de terminar la primera sesión confirmada" / "Once, N hours after the first confirmed session ends"; `hours` "Horas después" / "Hours after"; `hoursAfterFirstVisit` "{hours} h después de la primera visita" / "{hours} h after the first visit".

`bun run build`. Commit `feat(campaigns): first-visit trigger in the editor`.

## Tarea 5.4 — Plantillas de casa

**Files:**
- Modify: `app/lib/campaigns/templates.ts` (añadir dos plantillas con `blocksToDoc()`)

1. `first_visit_care` — "Cuidados tras tu drenaje": bloque de texto con instrucciones (placeholder: "Bebe agua, evita…"), **bloque de enlace al vídeo de respiración** (`{{video_url}}` NO: Maily no sabe de esa variable; poner la URL real que facilite el centro; hasta entonces `https://essentia.example/video` claramente marcado), despedida.
2. `first_visit_review` — "¿Qué tal tu sesión?": agradecimiento + botón "Dejar una reseña en Google" con la URL de reseña del centro (pedirla; placeholder visible).

Commit `feat(campaigns): house templates for the post-visit emails`.

## Tarea 5.5 — Configuración (operativa, sin código)

En `/dashboard/campaigns` crear dos campañas `automated`:
1. Nombre "Post‑drenaje · cuidados", trigger `first_visit` 0 h, segmento "ha reservado manual-therapies" (o el filtro de servicio que ya exista), plantilla `first_visit_care`, idiomas ES y EN, **activar**.
2. "Post‑drenaje · reseña", trigger `first_visit` 3 h, mismo segmento, plantilla `first_visit_review`, activar.

Probar con una reserva confirmada de prueba fechada hoy a una hora ya pasada: en el siguiente cron (o `curl -H "Authorization: Bearer $CRON_SECRET" $APP/api/cron/campaigns`) sale el email y `campaign_recipients` tiene la fila con `cycle = ''`. Una segunda reserva de la misma clienta **no** genera otro envío.

---

# FASE 6 — Varios

## Tarea 6.1 — Hero: decir dónde estamos

**Files:**
- Modify: `messages/es/home.json:6-15`, `messages/en/home.json` (mismas claves)

El `<h1>` es `subheadline` (`hero.tsx:292-294`); el texto grande es un `<p>` con `headline/headline2/headline3`. Cambios:

- ES: `headline3: "tu cuerpo"` → se mantiene; `subheadline` → `"Centro de Longevidad y Club de Bienestar Social en Santa Cruz de Tenerife"`.
- EN: `subheadline` → `"Longevity Center & Social Wellness Club in Santa Cruz de Tenerife"`.

Si el centro prefiere cambiar la frase grande, es `headline`/`headline2`/`headline3` y no afecta al SEO. Reiniciar `bun run dev` (memoria `dashboard-messages-need-dev-restart`). Commit `feat(home): the hero names Santa Cruz de Tenerife`.

## Tarea 6.2 — MCP: borradores de blog con ChatGPT

**Files:**
- Modify: `app/api/[transport]/route.ts`
- Modify: `env.example` (`MCP_API_KEY`)

**Decisión:** las herramientas de escritura exigen cabecera `Authorization: Bearer $MCP_API_KEY`. Las dos de lectura siguen abiertas. Comprobar el mecanismo de auth de `mcp-handler` 2 con `npx ctx7@latest library "mcp-handler" "withMcpAuth bearer token"`; si existe `withMcpAuth`, usarlo con un `verifyToken` que compare con `process.env.MCP_API_KEY` y marque `scopes: ["blog:write"]`; si no, leer la cabecera en el handler de cada tool y devolver `isError: true`.

Herramientas nuevas:
- `list_blog_categories` → `blog_categories` (`id, name, name_es, slug, slug_es`).
- `create_blog_category({ name, name_es, slug, slug_es })` (requiere clave).
- `create_blog_draft({ title, title_es, slug, slug_es, excerpt, excerpt_es, content, content_es, category_id, seo_title, seo_description, seo_title_es, seo_description_es, cover_image_url? })` → inserta en `blog_posts` con `status: "draft"` y `author_id = null`. **Nunca publica.** Devuelve el id y la URL `/dashboard/blog/<id>` para revisar.
- `list_blog_drafts` → últimos 20 con `status = 'draft'`.

Imágenes: ChatGPT puede generar la imagen pero no subirla aquí; se sube desde `/dashboard/blog/<id>` con el `ImageUpload` existente. Documentarlo en la descripción de la tool.

Actualizar `public/llms.txt` si lista las tools. Commit `feat(mcp): blog drafts and categories behind an API key`.

## Tarea 6.3 — Facial nuevo: ANESIS

Fuente: carta `ESSENTIA_Carta_Hotel_Lagos_de_Fanabe_CORREGIDA.pdf` (2026-11-03), tratamiento marcado por el centro. **Anesis · Facial hidratante y masaje craneofacial · 50 min · 70 €.** Descripción: "Un tratamiento facial que combina una preparación suave de la piel con productos cosméticos seleccionados por sus propiedades hidratantes, mascarilla y un delicado masaje facial, cervical y craneal. Una experiencia diseñada para aportar hidratación, luminosidad y confort a la piel, mientras favorece una profunda sensación de relajación y bienestar."

**Files:**
- Create: `insforge/migrations/20261105_tier_anesis.sql`
- Modify: `app/data/services-data.ts:281` (`facialTreatments`: añadir entrada `anesis` antes de `aurum`, misma forma que las existentes: `id, title, meta, description, image, thumbnail, highlights[3], durations, priceCenter`)
- Modify: `messages/es/wellness.json:333` y `:856` (dos bloques donde ya está `aurum`; copiar la estructura de `aurum` para `anesis`), y lo mismo en `messages/en/wellness.json`
- Add: `public/images/wellness/facials/heroes/anesis-1920x1080.webp` y `public/images/wellness/facials/cards/anesis-1200x675.webp` — **pedir las fotos al centro**; mientras tanto reutilizar las de `eleva` para que compile.

**Step 1: Migración**

```sql
INSERT INTO service_tiers (service_id, label, duration_minutes, price_eur, price_center_eur, color, active, sort_order, image_url)
SELECT 'facial-therapies', 'Anesis', 50, 70, 70, '#b45309', true, -1, '/images/wellness/facials/cards/anesis-1200x675.webp'
WHERE NOT EXISTS (SELECT 1 FROM service_tiers WHERE service_id = 'facial-therapies' AND label = 'Anesis');
```

`color` debe ser único (`20260809f_unique_tier_color.sql`): comprobar antes con `select color from service_tiers` y elegir uno libre. `sort_order = -1` lo pone primero; o renumerar Aurum/Eleva/Kinéa a 1/2/3.

**Step 2:** la página pública la genera `app/(site)/[locale]/(page)/wellness/facial-therapies/[slug]/page.tsx` a partir de `facialTreatments`, y el sitemap (`sitemap-data.ts:182`) la recoge solo. La reserva pública casa el tier por `label === title` (`confirm-step.tsx:treatmentByLabel`): **el `title` del estático debe ser exactamente `Anesis`.**

**Step 3:** `bun run build`; `/es/bienestar/terapias-faciales/anesis` existe; en Ajustes → Reservas aparece Anesis con 70 €.

**Step 4:** commit `feat(services): Anesis hydrating facial`.

**Nota sobre precios:** la carta es la del Hotel Lagos de Fañabé y sus precios no coinciden con los de la BD (Espira 70 vs 90, Aurum 110 vs 180, Eleva 90 vs 220…). El centro dijo que **los precios los cambia él** desde Ajustes → Reservas. No tocar precios en código salvo que lo pida.

## Tarea 6.4 — Notas operativas (sin código)

- **Colaboradora de España:** `/dashboard/users/new`, rol `partner`. Ya existe. Ve solo Resumen y Reservas.
- **Ocultar tratamientos:** Ajustes → Reservas → tipo de sesión → "Activo" apagado. Ya no se puede reservar. **Pero la página pública del tratamiento sigue existiendo** porque sale de `app/data/services-data.ts` (estático). Si hay que ocultarla también, es una tarea nueva: filtrar `manualTherapyTreatments` por tiers activos (consulta en el server component de la página de tratamientos).
- **Tratamientos nuevos (facial):** necesitan fila en `service_tiers` (migración con `INSERT`) y entrada en `services-data.ts` + traducciones. Esperar la información del centro.
- **Precios:** el centro los cambia en Ajustes → Reservas. `tier-modal.tsx` no deja editar `label` ni `image_url`; si lo piden, añadir ambos campos al modal.
- **Bug detectado de paso:** el trigger `profiles_guard_role` (`insforge/migrations/20260810e…`) asigna `role = 'client'` en inserts de no‑admin, valor que **no está en el CHECK** (`admin|staff|member|contact|partner`). Probable causa de la memoria `signup-profile-insert-fails`. Arreglar con una migración que use `'contact'`. Una tarea aparte.

---

## Pendiente de decidir por el centro (no bloquea empezar)

1. Política de cancelación con depósito (¿se devuelve? ¿con cuánta antelación?). Hasta que se decida, no hay devoluciones automáticas.
2. Validez de los bonos en días (el seed pone 180; el centro no lo fijó).
3. Razón social y datos de contacto del responsable de datos, si no están ya en `/privacy`.
4. URL del vídeo de respiración y URL de reseña de Google.
5. Fotos de Anesis (hero 1920×1080 y card 1200×675).
6. Fecha exacta de apertura de agenda → cuándo desplegar la Tarea 1.12.

Recibido ya: documento de consentimiento (2026-11-03) y precios de bonos (450 € / 800 €).
