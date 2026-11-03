"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { getAccessToken } from "@/lib/client-session";
import { formatMediumDate } from "@/utils/format";
import {
  fetchMcpConnections,
  revokeMcpConnections,
} from "@/actions/mcp-connections";
import {
  groupConnections,
  type ConnectionGroup,
  type KnownAssistant,
} from "@/lib/oauth/assistants";

type Rows = Awaited<ReturnType<typeof fetchMcpConnections>>;

const MCP_URL = `${(
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.essentiawellnessclub.com"
).replace(/\/$/, "")}/api/mcp`;

const TABS: KnownAssistant[] = ["chatgpt", "claude"];

/** The state of one assistant: not connected, or connected with its dates and a way to cut it off. */
function ConnectionStatus({
  loading,
  group,
  disconnecting,
  onDisconnect,
}: {
  loading: boolean;
  group: ConnectionGroup | null;
  disconnecting: boolean;
  onDisconnect: (group: ConnectionGroup) => void;
}) {
  const t = useTranslations("dashboard.account.mcp");
  const locale = useDashboardLocale();

  if (loading) {
    return <div className="bg-sand-100 h-14 animate-pulse rounded-xl" />;
  }
  if (!group) {
    return (
      <div className="flex items-center gap-2">
        <span className="bg-sand-100 text-petroleum-400 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <span className="bg-sand-500 size-1.5 rounded-full" />
          {t("connections.notConnected")}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
          <span className="size-1.5 rounded-full bg-green-500" />
          {t("connections.connected")}
        </span>
        <p className="text-petroleum-400 text-xs">
          {t("connections.since", {
            date: formatMediumDate(group.createdAt, locale),
          })}
          {" · "}
          {group.lastUsedAt
            ? t("connections.lastUsed", {
                date: formatMediumDate(group.lastUsedAt, locale),
              })
            : t("connections.neverUsed")}
        </p>
      </div>
      <Button
        variant="outline-danger"
        size="md"
        onClick={() => onDisconnect(group)}
        disabled={disconnecting}
      >
        {disconnecting
          ? t("connections.disconnecting")
          : t("connections.disconnect")}
      </Button>
    </div>
  );
}

/**
 * How to let ChatGPT or Claude use Essentia, and whether each already has.
 *
 * There is no key to copy: the address is all an assistant needs, and it sends
 * the person to sign in and approve. One tab per assistant shows only its own
 * steps and its own state — connected, since when, last used, with a way to cut
 * it off — and anything that is neither is listed apart so it can still be
 * disconnected.
 */
export function McpSection() {
  const t = useTranslations("dashboard.account.mcp");
  const [rows, setRows] = useState<Rows | null>(null);
  const [tab, setTab] = useState<KnownAssistant>("chatgpt");
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMcpConnections(getAccessToken()).then((result) => {
      if (!cancelled) setRows(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = groupConnections(rows ?? []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("urlLabel"), MCP_URL);
    }
  }

  async function disconnect(group: ConnectionGroup) {
    setRevoking(group.ids[0]!);
    await revokeMcpConnections(getAccessToken(), group.ids);
    setRows((current) =>
      (current ?? []).filter((row) => !group.ids.includes(row.id)),
    );
    setRevoking(null);
  }

  const steps = t.raw(`${tab}.steps`) as string[];

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("title")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">{t("hint")}</p>

      <div role="tablist" className="mb-5 flex gap-1">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`mcp-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="mcp-panel"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === id
                ? "bg-petroleum-700 text-white"
                : "text-petroleum-500 hover:bg-sand-100"
            }`}
          >
            {t(`${id}.title`)}
          </button>
        ))}
      </div>

      <div
        id="mcp-panel"
        role="tabpanel"
        aria-labelledby={`mcp-tab-${tab}`}
        className="flex flex-col gap-5"
      >
        <ol className="text-petroleum-500 list-decimal space-y-1 pl-5 text-sm">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="flex flex-col gap-1.5">
          <span className="text-petroleum-500 text-xs font-medium">
            {t("urlLabel")}
          </span>
          <div className="flex items-center gap-2">
            <code className="bg-sand-100 text-petroleum-700 min-w-0 flex-1 truncate rounded-xl px-4 py-3 text-sm">
              {MCP_URL}
            </code>
            <Button variant="outline" size="md" onClick={() => void copy()}>
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
        </div>

        <div className="border-sand-100 border-t pt-5">
          <ConnectionStatus
            loading={rows === null}
            group={grouped[tab]}
            disconnecting={revoking === grouped[tab]?.ids[0]}
            onDisconnect={(group) => void disconnect(group)}
          />
        </div>
      </div>

      {grouped.others.length > 0 && (
        <div className="border-sand-100 mt-6 border-t pt-5">
          <h3 className="text-petroleum-700 mb-3 text-sm font-medium">
            {t("connections.others")}
          </h3>
          <ul className="space-y-3">
            {grouped.others.map((group) => (
              <li
                key={group.ids[0]}
                className="border-sand-200 rounded-xl border p-4"
              >
                <p className="text-petroleum-700 mb-2 truncate text-sm font-medium">
                  {group.name}
                </p>
                <ConnectionStatus
                  loading={false}
                  group={group}
                  disconnecting={revoking === group.ids[0]}
                  onDisconnect={(g) => void disconnect(g)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
