import type {
  RegistrarAdapter,
  AdapterConfigField,
  AvailabilityResult,
  RegistrationResult,
  BalanceResult,
} from "../types";

const SANDBOX_URL = "https://api.sandbox.namecheap.com/xml.response";
const PRODUCTION_URL = "https://api.namecheap.com/xml.response";

export class NamecheapAdapter implements RegistrarAdapter {
  name = "namecheap";
  displayName = "Namecheap";
  configSchema: AdapterConfigField[] = [
    {
      key: "apiUser",
      label: "API User",
      type: "text",
      required: true,
      description: "Namecheap API username (usually same as your account username)",
    },
    {
      key: "clientIp",
      label: "Client IP",
      type: "text",
      required: true,
      description: "Your server IP (must be whitelisted in Namecheap panel)",
    },
  ];

  private apiKey = "";
  private apiUser = "";
  private clientIp = "";
  private baseUrl = SANDBOX_URL;

  initialize(config: {
    apiKey: string;
    apiSecret?: string;
    sandboxMode: boolean;
    extraConfig: Record<string, unknown>;
  }): void {
    this.apiKey = config.apiKey;
    this.apiUser = (config.extraConfig.apiUser as string) || "";
    this.clientIp = (config.extraConfig.clientIp as string) || "";
    this.baseUrl = config.sandboxMode ? SANDBOX_URL : PRODUCTION_URL;
  }

  private async request(
    command: string,
    params: Record<string, string> = {}
  ): Promise<string> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("ApiUser", this.apiUser);
    url.searchParams.set("ApiKey", this.apiKey);
    url.searchParams.set("UserName", this.apiUser);
    url.searchParams.set("ClientIp", this.clientIp);
    url.searchParams.set("Command", command);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "NameDrop/1.0" },
    });

    if (!res.ok) {
      throw new Error(`Namecheap API returned ${res.status}`);
    }

    return res.text();
  }

  private extractXmlValue(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private extractXmlAttr(xml: string, tag: string, attr: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private checkApiError(xml: string): void {
    const status = this.extractXmlAttr(xml, "ApiResponse", "Status");
    if (status === "ERROR") {
      const errMsg = this.extractXmlValue(xml, "Err") || "Unknown API error";
      throw new Error(`Namecheap: ${errMsg}`);
    }
  }

  async checkAvailability(domain: string): Promise<AvailabilityResult> {
    const xml = await this.request("namecheap.domains.check", {
      DomainList: domain,
    });
    this.checkApiError(xml);

    const available = this.extractXmlAttr(xml, "DomainCheckResult", "Available");
    return {
      available: available === "true",
    };
  }

  async registerDomain(
    domain: string,
    years: number = 1
  ): Promise<RegistrationResult> {
    const parts = domain.split(".");
    const sld = parts[0];
    const tld = parts.slice(1).join(".");

    const xml = await this.request("namecheap.domains.create", {
      DomainName: domain,
      Years: String(years),
      // Minimal required registrant info - user should configure in Namecheap account
      RegistrantFirstName: "Domain",
      RegistrantLastName: "Admin",
      RegistrantAddress1: "N/A",
      RegistrantCity: "N/A",
      RegistrantStateProvince: "N/A",
      RegistrantPostalCode: "00000",
      RegistrantCountry: "US",
      RegistrantPhone: "+1.0000000000",
      RegistrantEmailAddress: "admin@example.com",
      TechFirstName: "Domain",
      TechLastName: "Admin",
      TechAddress1: "N/A",
      TechCity: "N/A",
      TechStateProvince: "N/A",
      TechPostalCode: "00000",
      TechCountry: "US",
      TechPhone: "+1.0000000000",
      TechEmailAddress: "admin@example.com",
      AdminFirstName: "Domain",
      AdminLastName: "Admin",
      AdminAddress1: "N/A",
      AdminCity: "N/A",
      AdminStateProvince: "N/A",
      AdminPostalCode: "00000",
      AdminCountry: "US",
      AdminPhone: "+1.0000000000",
      AdminEmailAddress: "admin@example.com",
      AuxBillingFirstName: "Domain",
      AuxBillingLastName: "Admin",
      AuxBillingAddress1: "N/A",
      AuxBillingCity: "N/A",
      AuxBillingStateProvince: "N/A",
      AuxBillingPostalCode: "00000",
      AuxBillingCountry: "US",
      AuxBillingPhone: "+1.0000000000",
      AuxBillingEmailAddress: "admin@example.com",
    });
    this.checkApiError(xml);

    const registered = this.extractXmlAttr(xml, "DomainCreateResult", "Registered");
    const orderId = this.extractXmlAttr(xml, "DomainCreateResult", "OrderID");
    const chargedAmount = this.extractXmlAttr(xml, "DomainCreateResult", "ChargedAmount");

    if (registered === "true") {
      return {
        success: true,
        orderId: orderId || undefined,
        cost: chargedAmount ? parseFloat(chargedAmount) : undefined,
        currency: "USD",
      };
    }

    return {
      success: false,
      error: "Registration was not confirmed",
    };
  }

  async getBalance(): Promise<BalanceResult> {
    const xml = await this.request("namecheap.users.getBalances");
    this.checkApiError(xml);

    const balance = this.extractXmlAttr(xml, "UserGetBalancesResult", "AvailableBalance");
    const currency = this.extractXmlAttr(xml, "UserGetBalancesResult", "Currency");

    return {
      balance: balance ? parseFloat(balance) : 0,
      currency: currency || "USD",
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
