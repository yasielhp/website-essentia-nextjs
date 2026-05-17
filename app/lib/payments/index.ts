import type {
  PaymentProvider,
  PaymentConfig,
  StripeConfig,
  RedsysConfig,
} from "./types";
import { StripeProvider } from "./stripe";
import { RedsysProvider } from "./redsys";

export type { PaymentProvider, PaymentConfig, ProviderName } from "./types";
export type {
  CreateCheckoutParams,
  CheckoutSession,
  CreateRefundParams,
  Refund,
  WebhookEvent,
  StripeConfig,
  RedsysConfig,
} from "./types";

export function createPaymentProvider(cfg: PaymentConfig): PaymentProvider {
  if (cfg.provider === "stripe") {
    return new StripeProvider(cfg.config as StripeConfig);
  }
  if (cfg.provider === "redsys") {
    return new RedsysProvider(cfg.config as RedsysConfig);
  }
  throw new Error(
    `Unknown payment provider: ${String((cfg as { provider: string }).provider)}`,
  );
}

export function createProviderFromEnv(): PaymentProvider | null {
  const provider = process.env.PAYMENT_PROVIDER as
    | "stripe"
    | "redsys"
    | undefined;

  if (provider === "stripe") {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey || !webhookSecret) return null;
    return createPaymentProvider({
      provider: "stripe",
      config: {
        secretKey,
        webhookSecret,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      },
    });
  }

  if (provider === "redsys") {
    const merchantCode = process.env.REDSYS_MERCHANT_CODE;
    const terminal = process.env.REDSYS_TERMINAL;
    const secretKey = process.env.REDSYS_SECRET_KEY;
    if (!merchantCode || !terminal || !secretKey) return null;
    return createPaymentProvider({
      provider: "redsys",
      config: {
        merchantCode,
        terminal,
        secretKey,
        environment:
          (process.env.REDSYS_ENVIRONMENT as "test" | "live") ?? "test",
      },
    });
  }

  return null;
}
