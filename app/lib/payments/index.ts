import type { PaymentProvider, PaymentConfig, RedsysConfig } from "./types";
import { RedsysProvider } from "./redsys";

export type { PaymentProvider, PaymentConfig, ProviderName } from "./types";
export type {
  CreateCheckoutParams,
  CheckoutSession,
  CreateRefundParams,
  Refund,
  WebhookEvent,
  RedsysConfig,
} from "./types";

export function createPaymentProvider(cfg: PaymentConfig): PaymentProvider {
  return new RedsysProvider(cfg.config as RedsysConfig);
}

export function createProviderFromEnv(): PaymentProvider | null {
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
