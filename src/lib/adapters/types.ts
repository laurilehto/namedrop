export interface AdapterConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "boolean" | "number";
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

export interface AvailabilityResult {
  available: boolean;
  price?: number;
  currency?: string;
}

export interface RegistrationResult {
  success: boolean;
  orderId?: string;
  error?: string;
  cost?: number;
  currency?: string;
}

export interface BalanceResult {
  balance: number;
  currency: string;
}

export interface RegistrarAdapter {
  name: string;
  displayName: string;
  configSchema: AdapterConfigField[];

  initialize(config: {
    apiKey: string;
    apiSecret?: string;
    sandboxMode: boolean;
    extraConfig: Record<string, unknown>;
  }): void;

  checkAvailability(domain: string): Promise<AvailabilityResult>;
  registerDomain(domain: string, years?: number): Promise<RegistrationResult>;
  getBalance(): Promise<BalanceResult>;
  testConnection(): Promise<{ success: boolean; error?: string }>;
}
