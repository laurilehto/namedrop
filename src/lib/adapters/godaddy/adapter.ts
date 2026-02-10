import type {
  RegistrarAdapter,
  AdapterConfigField,
  AvailabilityResult,
  RegistrationResult,
  BalanceResult,
} from "../types";

const SANDBOX_URL = "https://api.ote-godaddy.com/v1";
const PRODUCTION_URL = "https://api.godaddy.com/v1";

export class GoDaddyAdapter implements RegistrarAdapter {
  name = "godaddy";
  displayName = "GoDaddy";
  configSchema: AdapterConfigField[] = [
    {
      key: "customerId",
      label: "Customer ID",
      type: "text",
      required: false,
      description:
        "GoDaddy customer/shopper ID (optional, for reseller accounts)",
    },
  ];

  private apiKey = "";
  private apiSecret = "";
  private baseUrl = SANDBOX_URL;
  private customerId = "";

  initialize(config: {
    apiKey: string;
    apiSecret?: string;
    sandboxMode: boolean;
    extraConfig: Record<string, unknown>;
  }): void {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret || "";
    this.baseUrl = config.sandboxMode ? SANDBOX_URL : PRODUCTION_URL;
    this.customerId = (config.extraConfig.customerId as string) || "";
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: Record<string, unknown> | Array<Record<string, unknown>>
  ): Promise<{ status: number; data: T }> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `sso-key ${this.apiKey}:${this.apiSecret}`,
      "User-Agent": "NameDrop/1.0",
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }
    if (this.customerId) {
      headers["X-Shopper-Id"] = this.customerId;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "GoDaddy: authentication failed — check your API key and secret"
      );
    }

    const data = (await res.json().catch(() => null)) as T;
    return { status: res.status, data };
  }

  async checkAvailability(domain: string): Promise<AvailabilityResult> {
    const { data } = await this.request<{
      available?: boolean;
      price?: number;
      currency?: string;
    }>("GET", `/domains/available?domain=${encodeURIComponent(domain)}`);

    if (!data) {
      return { available: false };
    }

    return {
      available: data.available ?? false,
      price: data.price ? data.price / 1_000_000 : undefined, // GoDaddy returns price in micro-units
      currency: data.currency || "USD",
    };
  }

  async registerDomain(
    domain: string,
    years: number = 1
  ): Promise<RegistrationResult> {
    const body = [
      {
        domain,
        period: years,
        consent: {
          agreedBy: "NameDrop",
          agreedAt: new Date().toISOString(),
          agreementKeys: ["DNRA"],
        },
      },
    ];

    const { status, data } = await this.request<{
      orderId?: number;
      message?: string;
      code?: string;
      fields?: Array<{ code?: string; message?: string }>;
    }>("POST", "/domains/purchase", body);

    if (status === 200 || status === 202) {
      return {
        success: true,
        orderId: String((data as Record<string, unknown>).orderId || ""),
      };
    }

    const errorMsg =
      data?.message ||
      data?.fields?.[0]?.message ||
      `Registration failed (HTTP ${status})`;

    return {
      success: false,
      error: `GoDaddy: ${errorMsg}`,
    };
  }

  async getBalance(): Promise<BalanceResult> {
    // GoDaddy doesn't have a direct balance API for standard accounts
    // For reseller accounts, the balance can be checked via the shopper API
    if (this.customerId) {
      try {
        const { data } = await this.request<{
          storeCredit?: { amount?: number; currency?: string };
        }>("GET", `/shoppers/${this.customerId}`);

        if (data?.storeCredit) {
          return {
            balance: data.storeCredit.amount ?? 0,
            currency: data.storeCredit.currency || "USD",
          };
        }
      } catch {
        // Fall through to default
      }
    }

    return { balance: 0, currency: "USD" };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { status } = await this.request(
        "GET",
        "/domains/available?domain=example.com"
      );
      if (status >= 200 && status < 300) {
        return { success: true };
      }
      return {
        success: false,
        error: `GoDaddy API returned HTTP ${status}`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }
}
