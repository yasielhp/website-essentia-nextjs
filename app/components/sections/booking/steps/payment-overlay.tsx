"use client";

import { useEffect, useRef } from "react";

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
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-submit the form → redirects to Redsys gateway
  useEffect(() => {
    const t = setTimeout(() => {
      formRef.current?.submit();
    }, 600); // brief delay so the user sees the redirect message
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Hidden Redsys form — auto-submitted */}
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
            Redirigiendo al pago seguro…
          </p>
          <p className="text-petroleum-400 text-xs">
            Te estamos llevando a la pasarela de pago de Redsys.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-petroleum-400 hover:text-petroleum-500 text-xs underline transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
