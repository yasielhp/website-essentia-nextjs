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

const REDSYS_ENDPOINTS = {
  test: "https://sis-t.redsys.es:25443/sis/realizarPago",
  live: "https://sis.redsys.es/sis/realizarPago",
} as const;

function signHmacSha256Base64(data: string, key: string): string {
  const decodedKey = Buffer.from(key, "base64");
  return crypto.createHmac("sha256", decodedKey).update(data).digest("base64");
}

function orderCode(length = 12): string {
  const now = Date.now().toString().slice(-length);
  return now.padStart(length, "0");
}

export class RedsysProvider implements PaymentProvider {
  readonly name = "redsys" as const;
  private config: RedsysConfig;

  constructor(config: RedsysConfig) {
    this.config = config;
  }

  async createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<CheckoutSession> {
    const order = orderCode(12);
    const currency = this.config.currency ?? "978";

    const merchantParams = {
      DS_MERCHANT_AMOUNT: String(params.amount),
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_MERCHANTCODE: this.config.merchantCode,
      DS_MERCHANT_CURRENCY: currency,
      DS_MERCHANT_TRANSACTIONTYPE: "0",
      DS_MERCHANT_TERMINAL: this.config.terminal,
      DS_MERCHANT_MERCHANTURL: params.metadata?.notifyUrl ?? "",
      DS_MERCHANT_URLOK: params.successUrl,
      DS_MERCHANT_URLKO: params.cancelUrl,
      DS_MERCHANT_PRODUCTDESCRIPTION: params.description.slice(0, 125),
    };

    const b64Params = Buffer.from(JSON.stringify(merchantParams)).toString(
      "base64",
    );
    const signature = signHmacSha256Base64(order, this.config.secretKey);

    const endpoint = REDSYS_ENDPOINTS[this.config.environment];

    const formHtml = `
<!DOCTYPE html><html><body>
<form id="redsys" action="${endpoint}" method="POST">
  <input type="hidden" name="Ds_SignatureVersion" value="HMAC_SHA256_V1"/>
  <input type="hidden" name="Ds_MerchantParameters" value="${b64Params}"/>
  <input type="hidden" name="Ds_Signature" value="${signature}"/>
</form>
<script>document.getElementById('redsys').submit();</script>
</body></html>`;

    const dataUrl = `data:text/html;base64,${Buffer.from(formHtml).toString("base64")}`;

    return {
      id: order,
      url: dataUrl,
      provider: "redsys",
    };
  }

  async createRefund(params: CreateRefundParams): Promise<Refund> {
    const order = orderCode(12);
    const currency = this.config.currency ?? "978";

    const merchantParams = {
      DS_MERCHANT_AMOUNT: String(params.amount ?? 0),
      DS_MERCHANT_ORDER: order,
      DS_MERCHANT_MERCHANTCODE: this.config.merchantCode,
      DS_MERCHANT_CURRENCY: currency,
      DS_MERCHANT_TRANSACTIONTYPE: "3",
      DS_MERCHANT_TERMINAL: this.config.terminal,
    };

    const b64Params = Buffer.from(JSON.stringify(merchantParams)).toString(
      "base64",
    );
    const signature = signHmacSha256Base64(order, this.config.secretKey);

    const endpoint =
      this.config.environment === "test"
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
    const errorMatch = xml.match(/<Ds_Response>(\d+)<\/Ds_Response>/);
    const code = errorMatch?.[1] ?? "9999";
    const success = parseInt(code, 10) < 100;

    return {
      id: params.transactionId,
      amount: params.amount ?? 0,
      currency,
      status: success ? "succeeded" : "failed",
    };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    try {
      const params = new URLSearchParams(rawBody);
      const merchantParams = params.get("Ds_MerchantParameters") ?? "";
      const decoded = JSON.parse(
        Buffer.from(merchantParams, "base64").toString(),
      ) as { DS_MERCHANT_ORDER?: string };
      const order = decoded.DS_MERCHANT_ORDER ?? "";
      const expected = signHmacSha256Base64(order, this.config.secretKey);
      const receivedClean = signature.replace(/-/g, "+").replace(/_/g, "/");
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(receivedClean),
      );
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

    return {
      type,
      provider: "redsys",
      payload: decoded,
    };
  }
}
