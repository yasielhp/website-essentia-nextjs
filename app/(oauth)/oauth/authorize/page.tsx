import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/actions/auth";
import { AuthorizeConsent } from "@/components/oauth/authorize-consent";
import { AuthorizeSignIn } from "@/components/oauth/authorize-sign-in";
import { getAppUrl } from "@/lib/env";
import { checkAuthorizeRequest } from "@/lib/oauth/authorize";
import { OAUTH_ROLES, authorizationRedirect } from "@/lib/oauth/core";
import { getClient } from "@/lib/oauth/server";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-sand-200 w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
      {children}
    </div>
  );
}

/**
 * Where an AI assistant sends the person to let it in.
 *
 * Checked on the server before anything is drawn: an unknown client or a
 * redirect address it did not register shows an error here and goes nowhere;
 * any other malformed request goes back to the client as the standard error.
 * Then one of three things: sign in, "your account cannot do this", or the
 * question itself — whether to let «client» act as this person.
 */
export default async function AuthorizePage({ searchParams }: Props) {
  const raw = await searchParams;
  const t = await getTranslations("oauth");

  const client = raw.client_id ? await getClient(raw.client_id) : null;
  const expectedResource = `${getAppUrl().replace(/\/$/, "")}/api/mcp`;
  const checked = checkAuthorizeRequest(raw, client, expectedResource);

  if (!checked.ok && checked.kind === "fatal") {
    return (
      <Card>
        <h1 className="font-display text-petroleum-700 text-2xl">
          {t("invalid.title")}
        </h1>
        <p className="text-petroleum-400 mt-3 text-sm leading-relaxed">
          {t("invalid.body")}
        </p>
      </Card>
    );
  }
  if (!checked.ok) {
    redirect(
      authorizationRedirect(checked.redirectUri, {
        error: checked.error,
        error_description: checked.description,
        state: checked.state,
      }),
    );
  }

  const { params } = checked;
  const { user, role } = await getSessionUser();

  if (!user) {
    return (
      <Card>
        <h1 className="font-display text-petroleum-700 text-2xl">
          {t("signIn.title")}
        </h1>
        <p className="text-petroleum-400 mt-3 mb-6 text-sm leading-relaxed">
          {t("signIn.body", { client: client!.clientName })}
        </p>
        <AuthorizeSignIn />
      </Card>
    );
  }

  const allowed = (OAUTH_ROLES as readonly string[]).includes(role ?? "");

  return (
    <Card>
      <h1 className="font-display text-petroleum-700 text-2xl">
        {t("consent.title")}
      </h1>
      <p className="text-petroleum-500 mt-3 text-sm leading-relaxed">
        {t.rich("consent.body", {
          client: client!.clientName,
          email: user.email ?? "",
          strong: (chunks) => (
            <strong className="text-petroleum-700 font-medium">{chunks}</strong>
          ),
        })}
      </p>
      <AuthorizeConsent
        allowed={allowed}
        params={{
          clientId: params.clientId,
          redirectUri: params.redirectUri,
          state: params.state,
          codeChallenge: params.codeChallenge,
          scope: params.scope,
          resource: params.resource,
        }}
      />
    </Card>
  );
}
