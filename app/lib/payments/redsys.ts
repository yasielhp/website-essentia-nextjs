import crypto from "crypto";
import type {
  PaymentProvider,
  RedsysConfig,
  CreateCheckoutParams,
  CheckoutSession,
  CreateRefundParams,
  Refund,
  WebhookEvent,
} from "./types";

// ─── Redsys endpoints ─────────────────────────────────────────

const REDSYS_ENDPOINTS = {
  test: "https://sis-t.redsys.es:25443/sis/realizarPago",
  live: "https://sis.redsys.es/sis/realizarPago",
} as const;

// ─── Crypto helpers ───────────────────────────────────────────

// Derive per-order key: 3DES-CBC(order, decoded_secret, iv=0)
function deriveOrderKey(order: string, secretKey: string): Buffer {
  const key = Buffer.from(secretKey, "base64");
  const iv = Buffer.alloc(8, 0);
  const cipher = crypto.createCipheriv("des-ede3-cbc", key, iv);
  cipher.setAutoPadding(true);
  return Buffer.concat([
    cipher.update(Buffer.from(order, "utf8")),
    cipher.final(),
  ]);
}

// HMAC-SHA256 of the Ds_MerchantParameters base64 string using the order key
function signParams(params: string, order: string, secretKey: string): string {
  const orderKey = deriveOrderKey(order, secretKey);
  return crypto
    .createHmac("sha256", orderKey)
    .update(params, "utf8")
    .digest("base64");
}

// Normalise Redsys URL-safe base64 to standard base64 before comparison
function normaliseB64(s: string): string {
  return s.replace(/-/g, "+").replace(/_/g, "/");
}

// Unique 12-digit numeric order ID (Redsys: 4-12 chars, starts with ≥4 digits)
function newOrderId(): string {
  return Date.now().toString().slice(-12);
}

// ─── Provider ─────────────────────────────────────────────────

export class RedsysProvider implements PaymentProvider {
  readonly name = "redsys" as const;
  private cfg: RedsysConfig;

  constructor(config: RedsysConfig) {
    this.cfg = config;
  }

  async createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<CheckoutSession> {
    const order = newOrderId();
    const currency = this.cfg.currency ?? "978"; // 978 = EUR

    const merchantParams = {
      DS_MERCHANT_AMOUNT: String(params.amount ?? 0),
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_MERCHANTCODE: this.cfg.merchantCode,
      DS_MERCHANT_CURRENCY: currency,
      DS_MERCHANT_TRANSACTIONTYPE: "0",
      DS_MERCHANT_TERMINAL: this.cfg.terminal,
      DS_MERCHANT_MERCHANTURL: params.metadata?.notifyUrl ?? "",
      DS_MERCHANT_URLOK: params.successUrl,
      DS_MERCHANT_URLKO: params.cancelUrl,
      DS_MERCHANT_PRODUCTDESCRIPTION: params.description.slice(0, 125),
      ...(params.customerEmail
        ? { DS_MERCHANT_TITULAR: params.customerName ?? params.customerEmail }
        : {}),
      DS_MERCHANT_CONSUMERLANGUAGE: "2", // 2 = Spanish
    };

    const b64Params = Buffer.from(JSON.stringify(merchantParams)).toString(
      "base64",
    );
    const signature = signParams(b64Params, order, this.cfg.secretKey);

    const endpoint = REDSYS_ENDPOINTS[this.cfg.environment];

    return {
      id: order,
      // Encode all form data in the URL so the client can render the redirect form
      url: `${endpoint}?Ds_MerchantParameters=${encodeURIComponent(b64Params)}&Ds_Signature=${encodeURIComponent(signature)}&Ds_SignatureVersion=HMAC_SHA256_V1`,
      provider: "redsys",
    };
  }

  /** Returns a Redsys form data object — exposed for the checkout API */
  buildFormData(params: CreateCheckoutParams): {
    formUrl: string;
    Ds_MerchantParameters: string;
    Ds_Signature: string;
    Ds_SignatureVersion: string;
    orderId: string;
  } {
    const order = newOrderId();
    const currency = this.cfg.currency ?? "978";

    const merchantParams = {
      DS_MERCHANT_AMOUNT: String(params.amount ?? 0),
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_MERCHANTCODE: this.cfg.merchantCode,
      DS_MERCHANT_CURRENCY: currency,
      DS_MERCHANT_TRANSACTIONTYPE: "0",
      DS_MERCHANT_TERMINAL: this.cfg.terminal,
      DS_MERCHANT_MERCHANTURL: params.metadata?.notifyUrl ?? "",
      DS_MERCHANT_URLOK: params.successUrl,
      DS_MERCHANT_URLKO: params.cancelUrl,
      DS_MERCHANT_PRODUCTDESCRIPTION: params.description.slice(0, 125),
      ...(params.customerEmail
        ? { DS_MERCHANT_TITULAR: params.customerName ?? params.customerEmail }
        : {}),
      DS_MERCHANT_CONSUMERLANGUAGE: "2",
    };

    const Ds_MerchantParameters = Buffer.from(
      JSON.stringify(merchantParams),
    ).toString("base64");
    const Ds_Signature = signParams(
      Ds_MerchantParameters,
      order,
      this.cfg.secretKey,
    );

    return {
      formUrl: REDSYS_ENDPOINTS[this.cfg.environment],
      Ds_MerchantParameters,
      Ds_Signature,
      Ds_SignatureVersion: "HMAC_SHA256_V1",
      orderId: order,
    };
  }

  async createRefund(params: CreateRefundParams): Promise<Refund> {
    const order = newOrderId();
    const currency = this.cfg.currency ?? "978";

    const merchantParams = {
      DS_MERCHANT_AMOUNT: String(params.amount ?? 0),
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_MERCHANTCODE: this.cfg.merchantCode,
      DS_MERCHANT_CURRENCY: currency,
      DS_MERCHANT_TRANSACTIONTYPE: "3",
      DS_MERCHANT_TERMINAL: this.cfg.terminal,
    };

    const b64Params = Buffer.from(JSON.stringify(merchantParams)).toString(
      "base64",
    );
    const signature = signParams(b64Params, order, this.cfg.secretKey);

    const endpoint =
      this.cfg.environment === "test"
        ? "https://sis-t.redsys.es:25443/sis/operaciones"
        : "https://sis.redsys.es/sis/operaciones";

    const body = new URLSearchParams({
      Ds_SignatureVersion: "HMAC_SHA256_V1",
      Ds_MerchantParameters: b64Params,
      Ds_Signature: signature,
    });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Redsys refund HTTP ${res.status}`);

    const xml = await res.text();
    const match = xml.match(/<Ds_Response>(\d+)<\/Ds_Response>/);
    const code = parseInt(match?.[1] ?? "9999", 10);

    return {
      id: params.transactionId,
      amount: params.amount ?? 0,
      currency,
      status: code < 100 ? "succeeded" : "failed",
    };
  }

  verifyWebhook(rawBody: string, receivedSignature: string): boolean {
    try {
      const params = new URLSearchParams(rawBody);
      const merchantParams = params.get("Ds_MerchantParameters") ?? "";
      const decoded = JSON.parse(
        Buffer.from(merchantParams, "base64").toString(),
      ) as {
        Ds_Order?: string;
      };
      const order = decoded.Ds_Order ?? "";
      const expected = signParams(merchantParams, order, this.cfg.secretKey);
      const clean = normaliseB64(receivedSignature);
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean));
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: string, signature: string): WebhookEvent {
    if (!this.verifyWebhook(rawBody, signature)) {
      throw new Error("Invalid Redsys webhook signature");
    }
    const params = new URLSearchParams(rawBody);
    const merchantParams = params.get("Ds_MerchantParameters") ?? "";
    const decoded = JSON.parse(
      Buffer.from(merchantParams, "base64").toString(),
    ) as Record<string, string>;

    const responseCode = parseInt(decoded.Ds_Response ?? "9999", 10);
    const type = responseCode < 100 ? "payment.succeeded" : "payment.failed";

    return { type, provider: "redsys", payload: decoded };
  }
}
