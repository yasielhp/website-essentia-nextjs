"use client";

import { Suspense, useEffect, useReducer, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { setContactNewsletter } from "@/actions/newsletter";
import { IconCheckmark, IconTrash } from "@/components/ui/icons";
import { deleteContact } from "@/actions/delete-contact";
import { getAccessToken } from "@/lib/client-session";
import { dashboardContactSchema, parseErrors } from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { toStoredGender } from "@/constants/gender";
import { fetchContactDetail, updateContact } from "@/actions/contacts";
import type {
  ContactBooking,
  ContactMembership,
  ContactRaceReg,
  ContactEduReg,
} from "@/types/contact";
import { DeleteDialog } from "./delete-dialog";
import { ContactDetailsCard } from "./contact-details-card";
import {
  TransactionsSection,
  BookingsSection,
  RaceRegsSection,
  EduRegsSection,
} from "./history-sections";
import { formReducer, initialFormState } from "./form-state";
import { BounceBanner, CampaignsSection } from "./campaigns-section";
import { clearContactBounce, fetchContactCampaigns } from "@/actions/campaigns";
import type { ContactCampaignRow } from "@/types/campaign";
import { fetchContactBonuses } from "@/actions/bonuses";
import type { ContactBonus } from "@/types/bonus";
import { BonusesSection } from "./bonuses-section";
import { ConsentSection } from "./consent-section";
import { fetchContactConsent } from "@/actions/consent";
import type { ContactConsent } from "@/types/consent";

/** The sections of a contact's file, top to bottom. */
type Section =
  | "details"
  | "consent"
  | "bonuses"
  | "bookings"
  | "transactions"
  | "races"
  | "education"
  | "campaigns";

type Booking = ContactBooking;
type Membership = ContactMembership;
type RaceReg = ContactRaceReg;
type EduReg = ContactEduReg;

// ─── Load reducer ─────────────────────────────────────────────

type LoadState = {
  loading: boolean;
  notFound: boolean;
  bookings: Booking[];
  memberships: Membership[];
  raceRegs: RaceReg[];
  eduRegs: EduReg[];
  campaigns: ContactCampaignRow[];
  bonuses: ContactBonus[];
  consent: ContactConsent | null;
  bouncedAt: string | null;
};

type LoadAction =
  | {
      type: "LOADED";
      bookings: Booking[];
      memberships: Membership[];
      raceRegs: RaceReg[];
      eduRegs: EduReg[];
      campaigns: ContactCampaignRow[];
      bonuses: ContactBonus[];
      consent: ContactConsent | null;
      bouncedAt: string | null;
    }
  | { type: "BONUSES_LOADED"; bonuses: ContactBonus[] }
  | { type: "BOUNCE_CLEARED" }
  | { type: "NOT_FOUND" };

const initialLoadState: LoadState = {
  loading: true,
  notFound: false,
  bookings: [],
  memberships: [],
  raceRegs: [],
  eduRegs: [],
  campaigns: [],
  bonuses: [],
  consent: null,
  bouncedAt: null,
};

function loadReducer(state: LoadState, action: LoadAction): LoadState {
  switch (action.type) {
    case "LOADED":
      return {
        loading: false,
        notFound: false,
        bookings: action.bookings,
        memberships: action.memberships,
        raceRegs: action.raceRegs,
        eduRegs: action.eduRegs,
        campaigns: action.campaigns,
        bonuses: action.bonuses,
        consent: action.consent,
        bouncedAt: action.bouncedAt,
      };
    case "BONUSES_LOADED":
      return { ...state, bonuses: action.bonuses };
    case "BOUNCE_CLEARED":
      return { ...state, bouncedAt: null };
    case "NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    default:
      return state;
  }
}

// ─── Form reducer ─────────────────────────────────────────────

// ─── Shared helpers ───────────────────────────────────────────

const SECTIONS: Section[] = [
  "details",
  "consent",
  "bonuses",
  "bookings",
  "transactions",
  "races",
  "education",
  "campaigns",
];

/**
 * One section of the file. With `emptyText` it collapses to a single line, the
 * title on the left and what is missing on the right; without, it is a card
 * with its title and the section inside.
 */
function SectionCard({
  id,
  title,
  emptyText = null,
  children,
}: {
  id: Section;
  title: string;
  emptyText?: string | null;
  children: React.ReactNode;
}) {
  if (emptyText) {
    return (
      <section
        id={`section-${id}`}
        className="border-sand-200 flex scroll-mt-20 items-center justify-between gap-4 rounded-2xl border bg-white px-6 py-4"
      >
        <h2 className="font-display text-petroleum-700 text-xl">{title}</h2>
        <p className="text-petroleum-300 text-sm">{emptyText}</p>
      </section>
    );
  }
  return (
    <section
      id={`section-${id}`}
      className="border-sand-200 scroll-mt-20 rounded-2xl border bg-white p-6"
    >
      <h2 className="font-display text-petroleum-700 mb-5 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function ContactDetailPageInner() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.contacts.detail");
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();

  const [loadState, dispatch] = useReducer(loadReducer, initialLoadState);
  const {
    loading,
    notFound,
    bookings,
    memberships,
    raceRegs,
    eduRegs,
    campaigns,
    bonuses,
    consent,
    bouncedAt,
  } = loadState;
  const [clearingBounce, setClearingBounce] = useState(false);

  // `?tab=` names a section to bring into view: finishing a booking started
  // from "Redeem" returns to the Bonuses card.
  const requestedSection = useSearchParams().get("tab");
  useEffect(() => {
    if (loading) return;
    const section = SECTIONS.find((s) => s === requestedSection);
    if (!section) return;
    document
      .getElementById(`section-${section}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, requestedSection]);

  const [form, dispatchForm] = useReducer(formReducer, initialFormState);
  const {
    firstName,
    lastName,
    email,
    phone,
    language,
    birthdate,
    gender,
    newsletterSubscribed,
    fieldErrors,
    error,
    saving,
    deleting,
    deleteOpen,
  } = form;

  const originalNewsletter = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await fetchContactDetail(getAccessToken(), id);
      if (cancelled) return;
      if (!result.found) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }

      const { contact, bookings, memberships, raceRegs, eduRegs } = result;
      const initialNewsletter = contact.newsletter_subscribed ?? false;
      originalNewsletter.current = initialNewsletter;
      dispatchForm({
        type: "INIT",
        firstName: contact.first_name ?? "",
        lastName: contact.last_name ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        language: contact.preferred_language ?? "en",
        birthdate: contact.birthdate ?? "",
        gender: contact.gender ?? "",
        newsletterSubscribed: initialNewsletter,
      });

      const [campaignRows, bonusRows, consentRow] = await Promise.all([
        fetchContactCampaigns(getAccessToken(), id),
        fetchContactBonuses(getAccessToken(), id),
        fetchContactConsent(getAccessToken(), id, { withSignature: false }),
      ]);
      if (cancelled) return;
      dispatch({
        type: "LOADED",
        bookings,
        memberships,
        raceRegs,
        eduRegs,
        campaigns: campaignRows,
        bonuses: bonusRows,
        consent: consentRow,
        bouncedAt: contact.email_bounced_at ?? null,
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatchForm({ type: "SET_ERROR", error: null });

    const errors = parseErrors(dashboardContactSchema, {
      firstName,
      lastName,
      email,
      phone,
      gender,
    });
    if (Object.keys(errors).length > 0) {
      dispatchForm({ type: "SET_FIELD_ERRORS", errors });
      return;
    }

    const trimmedFirst = firstName.trim();

    dispatchForm({ type: "SAVING_START" });

    const { error: updateErrorMsg } = await updateContact(
      getAccessToken(),
      id,
      {
        first_name: trimmedFirst,
        last_name: lastName.trim() || null,
        email: normalizeEmail(email),
        phone: normalizePhone(phone),
        preferred_language: language === "es" ? "es" : "en",
        gender: toStoredGender(gender),
        newsletter_subscribed: newsletterSubscribed,
        birthdate: birthdate || null,
      },
    );

    dispatchForm({ type: "SAVING_END" });

    if (updateErrorMsg) {
      dispatchForm({
        type: "SET_ERROR",
        error: updateErrorMsg ?? t("errors.saveFailed"),
      });
      return;
    }

    // Sync Resend audience only when the newsletter status actually changed
    const trimmedEmail = email.trim();
    if (trimmedEmail && newsletterSubscribed !== originalNewsletter.current) {
      try {
        await setContactNewsletter(
          getAccessToken(),
          trimmedEmail,
          newsletterSubscribed,
        );
        originalNewsletter.current = newsletterSubscribed;
      } catch {
        // fail-open: Resend sync failure must not block navigation
      }
    }

    notifySuccess(tToasts("contactSaved"));
    push("/dashboard/contacts");
  }

  async function handleDelete() {
    dispatchForm({ type: "DELETING_START" });
    const { error } = await deleteContact(getAccessToken(), id);
    if (error) {
      dispatchForm({ type: "SET_ERROR", error });
      dispatchForm({ type: "CLOSE_DELETE" });
      return;
    }
    notifySuccess(tToasts("contactDeleted"));
    push("/dashboard/contacts");
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Contact";

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">{t("notFound")}</p>
        <button
          onClick={() => back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          {t("goBack")}
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
          </h1>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => dispatchForm({ type: "OPEN_DELETE" })}
              disabled={loading}
              className="gap-1.5"
            >
              <IconTrash />
              {t("delete")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {bouncedAt && (
          <BounceBanner
            bouncedAt={bouncedAt}
            clearing={clearingBounce}
            onClear={() => {
              setClearingBounce(true);
              void clearContactBounce(getAccessToken(), id)
                .catch(() => ({ ok: false as const, error: "generic" }))
                .then((result) => {
                  setClearingBounce(false);
                  if (result.ok) {
                    dispatch({ type: "BOUNCE_CLEARED" });
                    notifySuccess(tToasts("bounceCleared"));
                  }
                });
            }}
          />
        )}
      </div>

      {/* One card per section, stacked: what the desk checks at every visit
          (details, consent, bonuses, bookings) is in view without a click.
          The sections nobody has anything in shrink to a single line. */}
      <div className="flex flex-col gap-6">
        <SectionCard id="details" title={t("details.heading")}>
          <form
            id="contact-form"
            onSubmit={(e) => void handleSave(e)}
            noValidate
          >
            <ContactDetailsCard
              firstName={firstName}
              lastName={lastName}
              email={email}
              phone={phone}
              language={language}
              birthdate={birthdate}
              gender={gender}
              newsletterSubscribed={newsletterSubscribed}
              fieldErrors={fieldErrors}
              loading={loading}
              saving={saving}
              dispatchForm={dispatchForm}
            />
            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                variant="solid"
                size="lg"
                disabled={saving || loading}
                className="gap-1.5"
              >
                <IconCheckmark />
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard id="consent" title={t("consent.heading")}>
          <ConsentSection loading={loading} consent={consent} contactId={id} />
        </SectionCard>

        <SectionCard id="bonuses" title={t("bonuses.heading")}>
          <BonusesSection
            loading={loading}
            bonuses={bonuses}
            contactId={id}
            onChanged={() =>
              void fetchContactBonuses(getAccessToken(), id).then((rows) =>
                dispatch({ type: "BONUSES_LOADED", bonuses: rows }),
              )
            }
          />
        </SectionCard>

        <SectionCard id="bookings" title={t("bookings.heading")}>
          <BookingsSection
            loading={loading}
            bookings={bookings}
            contactId={id}
          />
        </SectionCard>

        <SectionCard id="transactions" title={t("transactions.heading")}>
          <TransactionsSection
            loading={loading}
            bookings={bookings}
            memberships={memberships}
            raceRegs={raceRegs}
            eduRegs={eduRegs}
            bonuses={bonuses}
          />
        </SectionCard>

        <SectionCard
          id="campaigns"
          title={t("campaigns.tab")}
          emptyText={
            !loading && campaigns.length === 0 ? t("campaigns.empty") : null
          }
        >
          <CampaignsSection loading={loading} campaigns={campaigns} />
        </SectionCard>

        <SectionCard
          id="races"
          title={t("races.heading")}
          emptyText={
            !loading && raceRegs.length === 0 ? t("races.empty") : null
          }
        >
          <RaceRegsSection loading={loading} raceRegs={raceRegs} />
        </SectionCard>

        <SectionCard
          id="education"
          title={t("education.heading")}
          emptyText={
            !loading && eduRegs.length === 0 ? t("education.empty") : null
          }
        >
          <EduRegsSection loading={loading} eduRegs={eduRegs} />
        </SectionCard>
      </div>

      {deleteOpen && (
        <DeleteDialog
          name={displayName}
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => dispatchForm({ type: "CLOSE_DELETE" })}
        />
      )}
    </div>
  );
}

export default function ContactDetailPage() {
  return (
    <Suspense>
      <ContactDetailPageInner />
    </Suspense>
  );
}
