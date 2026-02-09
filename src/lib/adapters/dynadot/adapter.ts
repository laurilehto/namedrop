import type {
  RegistrarAdapter,
  AdapterConfigField,
  AvailabilityResult,
  RegistrationResult,
  BalanceResult,
} from "../types";

const SANDBOX_URL = "https://api-sandbox.dynadot.com/api3.json";
const PRODUCTION_URL = "https://api.dynadot.com/api3.json";

export class DynadotAdapter implements RegistrarAdapter {
  name = "dynadot";
  displayName = "Dynadot";
  configSchema: AdapterConfigField[] = [];

  private apiKey = "";
  private baseUrl = SANDBOX_URL;

  initialize(config: {
    apiKey: string;
    apiSecret?: string;
    sandboxMode: boolean;
    extraConfig: Record<string, unknown>;
  }): void {
    this.apiKey = config.apiKey;
    this.baseUrl = config.sandboxMode ? SANDBOX_URL : PRODUCTION_URL;
  }

  private async request(
    command: string,
    params: Record<string, string> = {}
  ): Promise<Record<string, unknown>> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("command", command);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "NameDrop/1.0" },
    });

    if (!res.ok) {
      throw new Error(`Dynadot API returned ${res.status}`);
    }

    const data = await res.json();
    return data as Record<string, unknown>;
  }

  async checkAvailability(domain: string): Promise<AvailabilityResult> {
    const data = await this.request("search", { domain0: domain });
    const searchResponse = data.SearchResponse as
      | { SearchResults?: Array<{ Available?: string; Price?: number; Currency?: string }> }
      | undefined;
    const results = searchResponse?.SearchResults;
    const result = results?.[0];

    return {
      available: result?.Available === "yes",
      price: result?.Price,
      currency: result?.Currency || "USD",
    };
  }

  async registerDomain(
    domain: string,
    years: number = 1
  ): Promise<RegistrationResult> {
    const data = await this.request("register", {
      domain: domain,
      duration: String(years),
    });

    const regResponse = data.RegisterResponse as
      | { Status?: string; DomainName?: string; Error?: string; Price?: number }
      | undefined;

    if (regResponse?.Status === "success") {
      return {
        success: true,
        orderId: regResponse.DomainName,
        cost: regResponse.Price,
        currency: "USD",
      };
    }

    return {
      success: false,
      error: regResponse?.Error || "Registration failed",
    };
  }

  async getBalance(): Promise<BalanceResult> {
    const data = await this.request("get_account_balance");
    const balanceResponse = data.GetAccountBalanceResponse as
      | { Balance?: number; Currency?: string }
      | undefined;

    return {
      balance: balanceResponse?.Balance ?? 0,
      currency: balanceResponse?.Currency || "USD",
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.getBalance();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }
}
