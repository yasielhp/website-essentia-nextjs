"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { getAccessToken } from "@/lib/client-session";
import { formatMediumDate } from "@/utils/format";
import {
  fetchMcpConnections,
  revokeMcpConnection,
} from "@/actions/mcp-connections";

type Connection = Awaited<ReturnType<typeof fetchMcpConnections>>[number];

const MCP_URL = `${(
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.essentiawellnessclub.com"
).replace(/\/$/, "")}/api/mcp`;

/**
 * How to let ChatGPT or Claude use Essentia, and who already has.
 *
 * There is no key to copy: the address below is all an assistant needs, and it
 * sends the person here to sign in and approve. The list is the person's own
 * connections, each of which can be cut off from here.
 */
export function McpSection() {
  const t = useTranslations("dashboard.account.mcp");
  const locale = useDashboardLocale();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMcpConnections(getAccessToken()).then((rows) => {
      if (!cancelled) setConnections(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("urlLabel"), MCP_URL);
    }
  }

  async function disconnect(id: string) {
    setRevoking(id);
    await revokeMcpConnection(getAccessToken(), id);
    setConnections((rows) => (rows ?? []).filter((c) => c.id !== id));
    setRevoking(null);
  }

  const steps = (key: "chatgpt" | "claude") =>
    t.raw(`${key}.steps`) as string[];

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("title")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">{t("hint")}</p>

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

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {(["chatgpt", "claude"] as const).map((key) => (
          <div key={key}>
            <h3 className="text-petroleum-700 mb-2 text-sm font-medium">
              {t(`${key}.title`)}
            </h3>
            <ol className="text-petroleum-500 list-decimal space-y-1 pl-5 text-sm">
              {steps(key).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="border-sand-100 mt-6 border-t pt-6">
        <h3 className="text-petroleum-700 mb-3 text-sm font-medium">
          {t("connections.title")}
        </h3>
        {connections === null ? (
          <div className="bg-sand-100 h-12 animate-pulse rounded-xl" />
        ) : connections.length === 0 ? (
          <p className="text-petroleum-300 text-sm">{t("connections.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="border-sand-200 flex items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="text-petroleum-700 truncate text-sm font-medium">
                    {c.clientName}
                  </p>
                  <p className="text-petroleum-400 text-xs">
                    {t("connections.since", {
                      date: formatMediumDate(c.createdAt, locale),
                    })}
                    {" · "}
                    {c.lastUsedAt
                      ? t("connections.lastUsed", {
                          date: formatMediumDate(c.lastUsedAt, locale),
                        })
                      : t("connections.neverUsed")}
                  </p>
                </div>
                <Button
                  variant="outline-danger"
                  size="md"
                  onClick={() => void disconnect(c.id)}
                  disabled={revoking === c.id}
                >
                  {revoking === c.id
                    ? t("connections.disconnecting")
                    : t("connections.disconnect")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
