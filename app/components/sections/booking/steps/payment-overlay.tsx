"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

export type RedsysFormData = {
  formUrl: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
  Ds_SignatureVersion: string;
  orderId: string;
};

export function PaymentOverlay({
  formData,
  onClose,
}: {
  formData: RedsysFormData;
  onClose: () => void;
}) {
  const t = useTranslations("booking.paymentOverlay");
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-submit via dynamically created form to guarantee correct encoding
  useEffect(() => {
    const timer = setTimeout(() => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = formData.formUrl;

      const fields: Record<string, string> = {
        Ds_SignatureVersion: formData.Ds_SignatureVersion,
        Ds_MerchantParameters: formData.Ds_MerchantParameters,
        Ds_Signature: formData.Ds_Signature,
      };

      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    }, 600);
    return () => clearTimeout(timer);
  }, [formData]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Hidden Redsys form — kept for fallback reference */}
      <form
        ref={formRef}
        action={formData.formUrl}
        method="POST"
        style={{ display: "none" }}
      >
        <input
          type="hidden"
          name="Ds_SignatureVersion"
          value={formData.Ds_SignatureVersion}
        />
        <input
          type="hidden"
          name="Ds_MerchantParameters"
          value={formData.Ds_MerchantParameters}
        />
        <input
          type="hidden"
          name="Ds_Signature"
          value={formData.Ds_Signature}
        />
      </form>

      {/* Visual feedback while redirecting */}
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl bg-white px-8 py-10 shadow-2xl">
        <div className="border-petroleum-200 border-t-petroleum-600 size-10 animate-spin rounded-full border-4" />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-petroleum-700 text-sm font-semibold">
            {t("redirecting")}
          </p>
          <p className="text-petroleum-400 text-xs">{t("takingYou")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-petroleum-400 hover:text-petroleum-500 text-xs underline transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
