"use client";

import type { ReactNode } from "react";
import {
  ConsentDialog,
  ConsentManagerProvider,
  ConsentBanner,
  ConsentDialogTrigger,
} from "@c15t/nextjs";
import { DevTools } from "@c15t/dev-tools/react";
import { policyPackPresets } from "c15t";
import { theme } from "./theme";
import { googleTagManager } from "@c15t/scripts/google-tag-manager";

const scripts = process.env.NEXT_PUBLIC_GTM_ID
  ? [googleTagManager({ id: process.env.NEXT_PUBLIC_GTM_ID })]
  : [];

const esTranslations = {
  common: {
    acceptAll: "Aceptar todo",
    rejectAll: "Rechazar todo",
    customize: "Personalizar",
    save: "Guardar ajustes",
    close: "Cerrar",
    securedBy: "Seguridad por",
  },
  cookieBanner: {
    title: "Valoramos tu privacidad",
    description:
      "Este sitio usa cookies para mejorar tu experiencia de navegación, analizar el tráfico y mostrar contenido personalizado.",
  },
  consentManagerDialog: {
    title: "Configuración de privacidad",
    description:
      "Personaliza aquí tu configuración de privacidad. Puedes elegir qué tipos de cookies y tecnologías de seguimiento permites.",
  },
  consentTypes: {
    necessary: {
      title: "Estrictamente necesarias",
      description:
        "Estas cookies son esenciales para que el sitio web funcione correctamente y no se pueden desactivar.",
    },
    functionality: {
      title: "Funcionalidad",
      description:
        "Estas cookies permiten una funcionalidad mejorada y la personalización del sitio web.",
    },
    marketing: {
      title: "Marketing",
      description:
        "Estas cookies se utilizan para mostrar publicidad relevante y medir su eficacia.",
    },
    measurement: {
      title: "Analítica",
      description:
        "Estas cookies nos ayudan a entender cómo interactúan los visitantes con el sitio web y a mejorar su rendimiento.",
    },
    experience: {
      title: "Experiencia",
      description:
        "Estas cookies nos ayudan a ofrecer una mejor experiencia de usuario y a probar nuevas funcionalidades.",
    },
  },
  legalLinks: {
    privacyPolicy: "Política de privacidad",
    cookiePolicy: "Política de cookies",
    termsOfService: "Términos de servicio",
  },
};

export default function ConsentManagerClient({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        overrides: { country: "ES" },
        theme,
        scripts,
        consentCategories: [
          "necessary",
          "measurement",
          "marketing",
          "functionality",
          "experience",
        ],
        offlinePolicy: {
          policyPacks: [
            policyPackPresets.europeOptIn(),
            policyPackPresets.worldNoBanner(),
          ],
        },
        i18n: {
          locale: "es",
          detectBrowserLanguage: false,
          messages: {
            es: esTranslations,
          },
        },
      }}
    >
      <ConsentBanner />
      <ConsentDialog />
      <ConsentDialogTrigger
        icon="fingerprint"
        showWhen="always"
        defaultPosition="bottom-left"
        size="sm"
      />
      <DevTools disabled={process.env.NODE_ENV === "production"} />
      {children}
    </ConsentManagerProvider>
  );
}
