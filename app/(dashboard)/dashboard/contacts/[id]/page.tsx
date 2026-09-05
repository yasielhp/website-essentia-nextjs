"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { TabButton } from "@/components/dashboard/settings/tab-button";
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

/** The five views of a contact's history. */
type HistoryTab =
  "transactions" | "bookings" | "races" | "education" | "campaigns";

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
      bouncedAt: string | null;
    }
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
        bouncedAt: action.bouncedAt,
      };
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

export default function ContactDetailPage() {
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
    bouncedAt,
  } = loadState;
  const [clearingBounce, setClearingBounce] = useState(false);

  const tHistory = useTranslations("dashboard.contacts.detail");
  const [tab, setTab] = useState<HistoryTab>("transactions");
  const historyTabs: { id: HistoryTab; label: string; count: number }[] = [
    {
      id: "transactions",
      label: tHistory("transactions.heading"),
      count: bookings.length + memberships.length,
    },
    {
      id: "bookings",
      label: tHistory("bookings.heading"),
      count: bookings.length,
    },
    { id: "races", label: tHistory("races.heading"), count: raceRegs.length },
    {
      id: "education",
      label: tHistory("education.heading"),
      count: eduRegs.length,
    },
    {
      id: "campaigns",
      label: tHistory("campaigns.tab"),
      count: campaigns.length,
    },
  ];

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

      const campaignRows = await fetchContactCampaigns(getAccessToken(), id);
      if (cancelled) return;
      dispatch({
        type: "LOADED",
        bookings,
        memberships,
        raceRegs,
        eduRegs,
        campaigns: campaignRows,
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
      <form onSubmit={(e) => void handleSave(e)} noValidate>
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
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
              className="gap-1.5"
            >
              <IconCheckmark />
              {saving ? t("saving") : t("save")}
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
      </form>

      {/* One card, four views. Stacked, the four lists pushed the form far up
          the page and most of them are empty for most contacts. */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="border-sand-100 -mx-6 -mt-6 mb-6 flex gap-1 overflow-x-auto border-b px-4 py-3">
          {historyTabs.map(({ id, label, count }) => (
            <TabButton key={id} active={tab === id} onClick={() => setTab(id)}>
              <span className="whitespace-nowrap">
                {label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${
                      tab === id ? "text-white/70" : "text-petroleum-300"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </span>
            </TabButton>
          ))}
        </div>

        {tab === "transactions" && (
          <TransactionsSection
            loading={loading}
            bookings={bookings}
            memberships={memberships}
            raceRegs={raceRegs}
            eduRegs={eduRegs}
          />
        )}
        {tab === "bookings" && (
          <BookingsSection loading={loading} bookings={bookings} />
        )}
        {tab === "races" && (
          <RaceRegsSection loading={loading} raceRegs={raceRegs} />
        )}
        {tab === "education" && (
          <EduRegsSection loading={loading} eduRegs={eduRegs} />
        )}
        {tab === "campaigns" && (
          <CampaignsSection loading={loading} campaigns={campaigns} />
        )}
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
