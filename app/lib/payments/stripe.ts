import Stripe from "stripe";
import type {
  PaymentProvider,
  StripeConfig,
  CreateCheckoutParams,
  CheckoutSession,
  CreateRefundParams,
  Refund,
  WebhookEvent,
} from "./types";

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private client: Stripe;
  private webhookSecret: string;

  constructor(config: StripeConfig) {
    this.client = new Stripe(config.secretKey);
    this.webhookSecret = config.webhookSecret;
  }

  async createCheckoutSession(
    params: CreateCheckoutParams,
  ): Promise<CheckoutSession> {
    const session = await this.client.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: params.currency.toLowerCase(),
            unit_amount: params.amount,
            product_data: { name: params.description },
          },
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer: params.customerId,
      metadata: params.metadata,
    });

    if (!session.url) throw new Error("Stripe session URL missing");

    return {
      id: session.id,
      url: session.url,
      provider: "stripe",
    };
  }

  async createRefund(params: CreateRefundParams): Promise<Refund> {
    const refund = await this.client.refunds.create({
      payment_intent: params.transactionId,
      ...(params.amount !== undefined && { amount: params.amount }),
      ...(params.reason && {
        reason: params.reason as Stripe.RefundCreateParams["reason"],
      }),
    });

    return {
      id: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status:
        refund.status === "succeeded"
          ? "succeeded"
          : refund.status === "pending"
            ? "pending"
            : "failed",
    };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    try {
      this.client.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
      return true;
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: string, signature: string): WebhookEvent {
    const event = this.client.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
    return {
      type: event.type,
      provider: "stripe",
      payload: event.data.object,
    };
  }
}
