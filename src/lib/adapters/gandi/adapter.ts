import type {
  RegistrarAdapter,
  AdapterConfigField,
  AvailabilityResult,
  RegistrationResult,
  BalanceResult,
} from "../types";

const SANDBOX_URL = "https://api.sandbox.gandi.net/v5";
const PRODUCTION_URL = "https://api.gandi.net/v5";

export class GandiAdapter implements RegistrarAdapter {
  name = "gandi";
  displayName = "Gandi.net";
  configSchema: AdapterConfigField[] = [
    {
      key: "organizationId",
      label: "Organization ID",
      type: "text",
      required: false,
      description:
        "Gandi organization/reseller ID (found in account settings). Required for registration.",
    },
  ];

  private apiKey = "";
  private baseUrl = SANDBOX_URL;
  private organizationId = "";

  initialize(config: {
    apiKey: string;
    apiSecret?: string;
    sandboxMode: boolean;
    extraConfig: Record<string, unknown>;
  }): void {
    this.apiKey = config.apiKey;
    this.baseUrl = config.sandboxMode ? SANDBOX_URL : PRODUCTION_URL;
    this.organizationId = (config.extraConfig.organizationId as string) || "";
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<{ status: number; data: T }> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": "NameDrop/1.0",
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Gandi: authentication failed — check your API key (Personal Access Token)");
    }

    const data = (await res.json().catch(() => null)) as T;
    return { status: res.status, data };
  }

  async checkAvailability(domain: string): Promise<AvailabilityResult> {
    const { data } = await this.request<{
      currency?: string;
      products?: Array<{
        status: string;
        prices?: Array<{ price_after_taxes?: number; duration_unit?: string }>;
      }>;
    }>("GET", `/domain/check?name=${encodeURIComponent(domain)}`);

    if (!data || !data.products || data.products.length === 0) {
      return { available: false };
    }

    const product = data.products[0];
    const available = product.status === "available";
    const priceEntry = product.prices?.find(
      (p) => p.duration_unit === "y"
    ) || product.prices?.[0];

    return {
      available,
      price: priceEntry?.price_after_taxes,
      currency: data.currency || "EUR",
    };
  }

  async registerDomain(
    domain: string,
    years: number = 1
  ): Promise<RegistrationResult> {
    const body: Record<string, unknown> = {
      fqdn: domain,
      duration: years,
    };

    if (this.organizationId) {
      body.sharing_id = this.organizationId;
    }

    const { status, data } = await this.request<{
      message?: string;
      id?: string;
      errors?: Array<{ description?: string; name?: string }>;
    }>("POST", "/domain/domains", body);

    if (status === 202 || status === 200) {
      return {
        success: true,
        orderId: (data as Record<string, unknown>).id as string | undefined,
      };
    }

    const errorMsg =
      data?.errors?.[0]?.description ||
      data?.message ||
      `Registration failed (HTTP ${status})`;

    return {
      success: false,
      error: `Gandi: ${errorMsg}`,
    };
  }

  async getBalance(): Promise<BalanceResult> {
    // Gandi prepaid balance is at /billing/info/{org_id} or /v5/organization/xxx
    // Try the organization billing endpoint
    if (this.organizationId) {
      try {
        const { data } = await this.request<{
          prepaid?: { amount?: number; currency?: string };
        }>("GET", `/billing/info/${this.organizationId}`);

        if (data?.prepaid) {
          return {
            balance: data.prepaid.amount ?? 0,
            currency: data.prepaid.currency || "EUR",
          };
        }
      } catch {
        // Fall through to default
      }
    }

    return { balance: 0, currency: "EUR" };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Simple domain check to verify the API key works
      const { status } = await this.request(
        "GET",
        "/domain/check?name=example.com"
      );
      if (status >= 200 && status < 300) {
        return { success: true };
      }
      return { success: false, error: `Gandi API returned HTTP ${status}` };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }
}
