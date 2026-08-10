"use client";

import { useCallback, useEffect, useReducer } from "react";
import { insforge } from "@/lib/insforge";
import { initialState, reducer } from "./enrollees-state";
import type { Contact } from "./types";
import type { Session } from "./types";

/**
 * Who is enrolled on this session, and the four writes the screen can make.
 *
 * A registration points at either a contact or a profile, never both, so the
 * names come from two tables and are merged here — the screen only ever sees a
 * person with a name, an email and a phone.
 */
export function useEnrollees(id: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { enrollees, contacts, search } = state;

  const loadEnrollees = useCallback(async () => {
    const { data: regs } = await insforge.database
      .from("education_registrations")
      .select("id, user_id, contact_id, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (!regs || (regs as unknown[]).length === 0) {
      dispatch({ type: "SET_ENROLLEES", enrollees: [] });
      return;
    }

    const regList = regs as {
      id: string;
      user_id: string | null;
      contact_id: string | null;
      created_at: string;
    }[];

    const contactIds = regList.flatMap((r) =>
      r.contact_id ? [r.contact_id] : [],
    );
    const userIds = regList.flatMap((r) => (r.user_id ? [r.user_id] : []));

    const contactMap: Record<
      string,
      { full_name: string | null; email: string | null; phone: string | null }
    > = {};
    const profileMap: Record<
      string,
      { full_name: string | null; email: string | null }
    > = {};

    if (contactIds.length > 0) {
      const { data } = await insforge.database
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .in("id", contactIds);
      if (data) {
        for (const c of data as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
        }[]) {
          contactMap[c.id] = {
            full_name:
              [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
            email: c.email,
            phone: c.phone,
          };
        }
      }
    }

    if (userIds.length > 0) {
      const { data } = await insforge.database
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (data) {
        for (const p of data as {
          id: string;
          full_name: string | null;
          email: string | null;
        }[]) {
          profileMap[p.id] = { full_name: p.full_name, email: p.email };
        }
      }
    }

    dispatch({
      type: "SET_ENROLLEES",
      enrollees: regList.map((r) => {
        const c = r.contact_id ? contactMap[r.contact_id] : null;
        const p = r.user_id ? profileMap[r.user_id] : null;
        return {
          id: r.id,
          contact_id: r.contact_id,
          profile_id: r.user_id,
          full_name: c?.full_name ?? p?.full_name ?? null,
          email: c?.email ?? p?.email ?? null,
          phone: c?.phone ?? null,
          registered_at: r.created_at,
        };
      }),
    });
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      dispatch({ type: "LOAD_START" });

      const { data: sessionData } = await insforge.database
        .from("education_sessions")
        .select("id, title, date, max_participants")
        .eq("id", id)
        .limit(1);

      if (cancelled) return;

      const sessionRow = (sessionData as Session[] | null)?.[0];
      if (!sessionRow) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }

      await loadEnrollees();

      if (cancelled) return;

      dispatch({ type: "LOAD_SUCCESS", session: sessionRow });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, loadEnrollees]);

  async function handleRemove(enrolleeId: string) {
    dispatch({ type: "REMOVING_START", id: enrolleeId });
    await insforge.database
      .from("education_registrations")
      .delete()
      .eq("id", enrolleeId);
    dispatch({ type: "REMOVING_DONE" });
    await loadEnrollees();
  }

  async function openAdd() {
    dispatch({ type: "CONTACTS_LOADING" });

    const registeredContactIds = new Set(
      enrollees.flatMap((e) => (e.contact_id ? [e.contact_id] : [])),
    );

    const { data } = await insforge.database
      .from("contacts")
      .select("id, first_name, last_name, email, phone")
      .order("first_name", { ascending: true });

    const all =
      (data as
        | {
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            phone: string | null;
          }[]
        | null) ?? [];

    dispatch({
      type: "OPEN_ADD",
      contacts: all.flatMap((c) =>
        registeredContactIds.has(c.id)
          ? []
          : [
              {
                id: c.id,
                full_name:
                  [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
                email: c.email,
                phone: c.phone,
              },
            ],
      ),
    });
  }

  async function handleAddContact(contact: Contact) {
    dispatch({ type: "ADDING_START", id: contact.id });
    await insforge.database
      .from("education_registrations")
      .insert([{ session_id: id, contact_id: contact.id }]);
    dispatch({ type: "ADDING_DONE" });
    await loadEnrollees();
  }

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      String(c.phone ?? "").includes(q)
    );
  });

  return {
    ...state,
    filteredContacts,
    openAdd,
    closeAdd: () => dispatch({ type: "CLOSE_ADD" }),
    setSearch: (search: string) => dispatch({ type: "SET_SEARCH", search }),
    setRemoveOpen: (enrolleeId: string | null) =>
      dispatch({ type: "SET_REMOVE_OPEN", id: enrolleeId }),
    remove: handleRemove,
    addContact: handleAddContact,
  };
}
