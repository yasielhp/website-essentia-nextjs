"use client";

import { useEffect, useReducer } from "react";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

type PageState = {
  loading: boolean;
  saving: boolean;
  savedOk: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string;
};

type PageAction =
  | {
      type: "LOAD_SUCCESS";
      payload: {
        firstName: string;
        lastName: string;
        phone: string;
        avatarUrl: string;
      };
    }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_SAVED_OK"; value: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_FIRST_NAME"; value: string }
  | { type: "SET_LAST_NAME"; value: string }
  | { type: "SET_PHONE"; value: string }
  | { type: "SET_AVATAR_URL"; value: string };

const initialState: PageState = {
  loading: true,
  saving: false,
  savedOk: false,
  error: null,
  firstName: "",
  lastName: "",
  phone: "",
  avatarUrl: "",
};

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return { ...state, loading: false, ...action.payload };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_SAVED_OK":
      return { ...state, savedOk: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_FIRST_NAME":
      return { ...state, firstName: action.value };
    case "SET_LAST_NAME":
      return { ...state, lastName: action.value };
    case "SET_PHONE":
      return { ...state, phone: action.value };
    case "SET_AVATAR_URL":
      return { ...state, avatarUrl: action.value };
  }
}

export default function DashboardAccountPage() {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { loading, saving, savedOk, error, firstName, lastName, phone, avatarUrl } =
    state;

  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!user) return;
      const { data } = await insforge.database
        .from("profiles")
        .select("first_name, last_name, full_name, phone, avatar_url")
        .eq("id", user.id)
        .single();

      const profile = data as {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        phone: string | null;
        avatar_url: string | null;
      } | null;

      const derivedFirst =
        profile?.first_name ??
        (profile?.full_name ? profile.full_name.split(" ")[0] : "");
      const derivedLast =
        profile?.last_name ??
        (profile?.full_name
          ? profile.full_name.split(" ").slice(1).join(" ")
          : "");

      dispatch({
        type: "LOAD_SUCCESS",
        payload: {
          firstName: derivedFirst ?? "",
          lastName: derivedLast ?? "",
          phone: profile?.phone ?? "",
          avatarUrl: profile?.avatar_url ?? "",
        },
      });
    }

    void load();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: null });
    dispatch({ type: "SET_SAVED_OK", value: false });

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      dispatch({ type: "SET_ERROR", error: "First name is required." });
      return;
    }

    dispatch({ type: "SET_SAVING", value: true });
    const fullName = [trimmedFirst, lastName.trim()].filter(Boolean).join(" ");

    await insforge.database
      .from("profiles")
      .update({
        first_name: trimmedFirst,
        last_name: lastName.trim() || null,
        full_name: fullName,
        phone: phone.trim() || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", user!.id);

    dispatch({ type: "SET_SAVING", value: false });
    dispatch({ type: "SET_SAVED_OK", value: true });
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="font-display text-petroleum-700 text-3xl">My account</h1>
        <p className="text-petroleum-400 mt-1 text-sm">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <form onSubmit={(e) => void handleSave(e)} noValidate>
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Profile
              </h2>

              {error && (
                <p className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}
              {savedOk && (
                <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                  Changes saved.
                </p>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="firstName"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      First name <span className="text-red-400">*</span>
                    </label>
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_FIRST_NAME",
                            value: e.target.value,
                          })
                        }
                        placeholder="Jane"
                        disabled={saving}
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="lastName"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Last name
                    </label>
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_LAST_NAME",
                            value: e.target.value,
                          })
                        }
                        placeholder="Doe"
                        disabled={saving}
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email ?? ""}
                    disabled
                    readOnly
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="phone"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Phone
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        dispatch({ type: "SET_PHONE", value: e.target.value })
                      }
                      placeholder="+34 600 000 000"
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  type="submit"
                  variant="solid"
                  size="md"
                  disabled={saving || loading}
                  className="gap-1.5"
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </form>

        </div>

        <div>
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Photo
            </h2>
            {loading ? (
              <div className="bg-sand-100 h-36 animate-pulse rounded-xl" />
            ) : (
              <ImageUpload
                bucket="events"
                folder="staff"
                value={avatarUrl}
                onChange={(value) =>
                  dispatch({ type: "SET_AVATAR_URL", value })
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
