import {
  createRedsysAPI,
  SANDBOX_URLS,
  PRODUCTION_URLS,
  CURRENCIES,
  TRANSACTION_TYPES,
} from "redsys-easy";
import type {
  PaymentProvider,
  RedsysConfig,
  CreateCheckoutParams,
  CheckoutSession,
  CreateRefundParams,
  Refund,
  WebhookEvent,
} from "./types";

// ─── Provider ─────────────────────────────────────────────────

export class RedsysProvider implements PaymentProvider {
  readonly name = "redsys" as const;
  private cfg: RedsysConfig;
  private api: ReturnType<typeof createRedsysAPI>;

  constructor(config: RedsysConfig) {
    this.cfg = config;
    this.api = createRedsysAPI({
      secretKey: config.secretKey,
      urls: config.environment === "live" ? PRODUCTION_URLS : SANDBOX_URLS,
    });
  }

  private newOrderId(): string {
    return Date.now().toString().slice(-12);
  }

  /** Returns a Redsys form data object — exposed for the checkout API */
  buildFormData(params: CreateCheckoutParams): {
    formUrl: string;
    Ds_MerchantParameters: string;
    Ds_Signature: string;
    Ds_SignatureVersion: string;
    orderId: string;
  } {
    const order = this.newOrderId();
    const currency = CURRENCIES["EUR"];
    const amountCents = String(params.amount ?? 0);

    const form = this.api.createRedirectForm({
      DS_MERCHANT_MERCHANTCODE: this.cfg.merchantCode,
      DS_MERCHANT_TERMINAL: this.cfg.terminal,
      DS_MERCHANT_TRANSACTIONTYPE: TRANSACTION_TYPES.AUTHORIZATION,
      DS_MERCHANT_AMOUNT: amountCents,
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_CURRENCY: currency.num,
      DS_MERCHANT_MERCHANTURL: params.metadata?.notifyUrl ?? "",
      DS_MERCHANT_URLOK: params.successUrl,
      DS_MERCHANT_URLKO: params.cancelUrl,
      DS_MERCHANT_PRODUCTDESCRIPTION: params.description.slice(0, 125),
      ...(params.customerEmail
        ? {
            DS_MERCHANT_TITULAR: params.customerName ?? params.customerEmail,
          }
        : {}),
      DS_MERCHANT_CONSUMERLANGUAGE: "2",
    });

    return {
      formUrl: form.url,
      Ds_MerchantParameters: form.body.Ds_MerchantParameters,
      Ds_Signature: form.body.Ds_Signature,
      Ds_SignatureVersion: form.body.Ds_SignatureVersion,
      orderId: order,
    };
  }

  async createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<CheckoutSession> {
    const form = this.buildFormData(params);
    return {
      id: form.orderId,
      url: `${form.formUrl}?Ds_MerchantParameters=${encodeURIComponent(form.Ds_MerchantParameters)}&Ds_Signature=${encodeURIComponent(form.Ds_Signature)}&Ds_SignatureVersion=${form.Ds_SignatureVersion}`,
      provider: "redsys",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createRefund(_params: CreateRefundParams): Promise<Refund> {
    throw new Error("Refunds not implemented via redsys-easy yet");
  }

  verifyWebhook(rawBody: string, receivedSignature: string): boolean {
    try {
      const params = new URLSearchParams(rawBody);
      const merchantParams = params.get("Ds_MerchantParameters") ?? "";
      const signature = params.get("Ds_Signature") ?? receivedSignature;
      this.api.processRestNotification({
        Ds_MerchantParameters: merchantParams,
        Ds_Signature: signature,
        Ds_SignatureVersion: "HMAC_SHA256_V1",
      });
      return true;
    } catch {
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseWebhookEvent(rawBody: string, _signature: string): WebhookEvent {
    const params = new URLSearchParams(rawBody);
    const merchantParams = params.get("Ds_MerchantParameters") ?? "";
    const signature = params.get("Ds_Signature") ?? "";

    const result = this.api.processRestNotification({
      Ds_MerchantParameters: merchantParams,
      Ds_Signature: signature,
      Ds_SignatureVersion: "HMAC_SHA256_V1",
    });

    const responseCode = parseInt(String(result.Ds_Response ?? "9999"), 10);
    const type = responseCode < 100 ? "payment.succeeded" : "payment.failed";

    return {
      type,
      provider: "redsys",
      payload: result as unknown as Record<string, string>,
    };
  }
}
