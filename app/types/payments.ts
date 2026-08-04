export type RedsysEnvironment = "test" | "live";

export type RedsysStatus = {
  connected: boolean;
  hasMerchantCode: boolean;
  hasSecretKey: boolean;
  environment: RedsysEnvironment;
};
