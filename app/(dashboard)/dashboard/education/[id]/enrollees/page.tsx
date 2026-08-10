"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddEnrolleeModal, PageHeader } from "./enrollee-sections";
import { EnrolleeTable } from "./enrollee-table";
import { useEnrollees } from "./use-enrollees";

export default function EnrolleesPage() {
  const t = useTranslations("dashboard.education.enrollees");
  const { id } = useParams<{ id: string }>();
  const { back } = useRouter();

  const {
    session,
    enrollees,
    loading,
    notFound,
    contactsLoading,
    removingId,
    addingId,
    removeOpen,
    addOpen,
    search,
    filteredContacts,
    openAdd,
    closeAdd,
    setSearch,
    setRemoveOpen,
    remove,
    addContact,
  } = useEnrollees(id);

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
      <PageHeader
        title={session?.title}
        loading={loading}
        onAddOpen={() => void openAdd()}
      />

      <EnrolleeTable
        session={session}
        enrollees={enrollees}
        loading={loading}
        removeOpen={removeOpen}
        removingId={removingId}
        onConfirmOpen={setRemoveOpen}
        onConfirmClose={() => setRemoveOpen(null)}
        onRemove={(enrolleeId) => void remove(enrolleeId)}
      />

      {addOpen && (
        <AddEnrolleeModal
          search={search}
          contactsLoading={contactsLoading}
          filteredContacts={filteredContacts}
          addingId={addingId}
          onClose={closeAdd}
          onSearch={setSearch}
          onAdd={(contact) => void addContact(contact)}
        />
      )}
    </div>
  );
}
