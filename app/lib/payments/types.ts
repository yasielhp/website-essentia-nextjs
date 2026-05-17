export type ProviderName = "stripe" | "redsys";

// ─── Shared params / results ──────────────────────────────────

export type CreateCheckoutParams = {
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  customerId?: string;
};

export type CheckoutSession = {
  id: string;
  url: string;
  provider: ProviderName;
};

export type CreateRefundParams = {
  transactionId: string;
  amount?: number;
  reason?: string;
};

export type Refund = {
  id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
};

export type WebhookEvent = {
  type: string;
  provider: ProviderName;
  payload: unknown;
};

// ─── Provider contract ────────────────────────────────────────

export interface PaymentProvider {
  readonly name: ProviderName;
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession>;
  createRefund(params: CreateRefundParams): Promise<Refund>;
  parseWebhookEvent(rawBody: string, signature: string): WebhookEvent;
  verifyWebhook(rawBody: string, signature: string): boolean;
}

// ─── Configuration shapes ─────────────────────────────────────

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  publishableKey?: string;
};

export type RedsysConfig = {
  merchantCode: string;
  terminal: string;
  secretKey: string;
  environment: "test" | "live";
  currency?: string;
};

export type PaymentConfig =
  | { provider: "stripe"; config: StripeConfig }
  | { provider: "redsys"; config: RedsysConfig };
