const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  return DOMAIN_REGEX.test(domain);
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

export function extractTLD(domain: string): string {
  const parts = domain.split(".");
  if (parts.length < 2) return "";
  // Handle common second-level TLDs like .co.uk, .com.au
  const lastTwo = parts.slice(-2).join(".");
  const knownSecondLevel = ["co.uk", "com.au", "co.nz", "com.br", "co.jp", "org.uk", "net.au"];
  if (parts.length > 2 && knownSecondLevel.includes(lastTwo)) {
    return lastTwo;
  }
  return parts[parts.length - 1];
}

export function parseDomainInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((d) => normalizeDomain(d))
    .filter((d) => d && isValidDomain(d));
}
