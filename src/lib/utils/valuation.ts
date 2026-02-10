/**
 * Simple heuristic-based domain valuation estimate.
 * This is NOT a real appraisal — it's a rough indicator based on observable factors.
 */

const PREMIUM_TLDS: Record<string, number> = {
  com: 1.0,
  net: 0.6,
  org: 0.5,
  io: 0.7,
  ai: 0.9,
  co: 0.5,
  dev: 0.6,
  app: 0.5,
  xyz: 0.2,
  me: 0.3,
  info: 0.2,
  biz: 0.2,
};

const PREMIUM_KEYWORDS = [
  "ai", "app", "auto", "bank", "bet", "buy", "car", "cash", "chat",
  "cloud", "code", "coin", "crypto", "data", "deal", "dev", "digital",
  "finance", "fire", "fit", "fly", "food", "free", "game", "go", "gold",
  "green", "health", "home", "host", "hub", "job", "lab", "link", "live",
  "loan", "mail", "map", "market", "media", "meta", "money", "net",
  "news", "next", "pay", "pet", "play", "pro", "rent", "sale", "save",
  "shop", "smart", "social", "solar", "sport", "star", "store", "stream",
  "tech", "trade", "travel", "trust", "vip", "vote", "wallet", "web", "win",
];

export interface ValuationResult {
  score: number; // 0-100
  estimatedRange: { min: number; max: number };
  factors: ValuationFactor[];
  tier: "premium" | "high" | "medium" | "low" | "minimal";
}

export interface ValuationFactor {
  name: string;
  impact: "positive" | "negative" | "neutral";
  description: string;
}

export function estimateValue(domain: string): ValuationResult {
  const parts = domain.split(".");
  const sld = parts[0]; // second-level domain (e.g., "example" in "example.com")
  const tld = parts.slice(1).join(".");
  const factors: ValuationFactor[] = [];
  let score = 50; // start at midpoint

  // 1. Domain length (shorter = more valuable)
  if (sld.length <= 2) {
    score += 30;
    factors.push({ name: "Ultra-short", impact: "positive", description: `${sld.length} characters — extremely rare and valuable` });
  } else if (sld.length <= 3) {
    score += 25;
    factors.push({ name: "Very short", impact: "positive", description: `${sld.length} characters — highly sought after` });
  } else if (sld.length <= 4) {
    score += 18;
    factors.push({ name: "Short", impact: "positive", description: `${sld.length} characters — premium length` });
  } else if (sld.length <= 6) {
    score += 8;
    factors.push({ name: "Good length", impact: "positive", description: `${sld.length} characters — easy to remember` });
  } else if (sld.length <= 10) {
    score += 0;
    factors.push({ name: "Average length", impact: "neutral", description: `${sld.length} characters` });
  } else if (sld.length <= 15) {
    score -= 5;
    factors.push({ name: "Long", impact: "negative", description: `${sld.length} characters — harder to brand` });
  } else {
    score -= 15;
    factors.push({ name: "Very long", impact: "negative", description: `${sld.length} characters — too long for most uses` });
  }

  // 2. TLD value
  const tldMultiplier = PREMIUM_TLDS[tld] ?? 0.15;
  if (tldMultiplier >= 0.9) {
    score += 15;
    factors.push({ name: `Premium TLD (.${tld})`, impact: "positive", description: "Top-tier domain extension" });
  } else if (tldMultiplier >= 0.5) {
    score += 8;
    factors.push({ name: `Good TLD (.${tld})`, impact: "positive", description: "Well-known extension" });
  } else if (tldMultiplier >= 0.2) {
    score -= 3;
    factors.push({ name: `Standard TLD (.${tld})`, impact: "neutral", description: "Common but less premium" });
  } else {
    score -= 10;
    factors.push({ name: `Niche TLD (.${tld})`, impact: "negative", description: "Less recognized extension" });
  }

  // 3. Keyword match
  const sldLower = sld.toLowerCase();
  const matchedKeywords = PREMIUM_KEYWORDS.filter(
    (kw) => sldLower === kw || sldLower.startsWith(kw) || sldLower.endsWith(kw)
  );
  if (sldLower.length <= 6 && PREMIUM_KEYWORDS.includes(sldLower)) {
    score += 20;
    factors.push({ name: "Exact keyword match", impact: "positive", description: `"${sldLower}" is a premium keyword` });
  } else if (matchedKeywords.length > 0) {
    score += 8;
    factors.push({ name: "Contains keyword", impact: "positive", description: `Contains: ${matchedKeywords.join(", ")}` });
  }

  // 4. Character composition
  const hasNumbers = /\d/.test(sld);
  const hasHyphens = sld.includes("-");
  const isAllLetters = /^[a-zA-Z]+$/.test(sld);
  const isAllNumbers = /^\d+$/.test(sld);

  if (isAllLetters) {
    score += 5;
    factors.push({ name: "Letters only", impact: "positive", description: "Clean, brandable format" });
  } else if (isAllNumbers && sld.length <= 4) {
    score += 10;
    factors.push({ name: "Numeric domain", impact: "positive", description: "Short numeric domains are collectible" });
  }
  if (hasHyphens) {
    score -= 10;
    factors.push({ name: "Contains hyphens", impact: "negative", description: "Hyphens reduce value" });
  }
  if (hasNumbers && !isAllNumbers) {
    score -= 5;
    factors.push({ name: "Mixed alphanumeric", impact: "negative", description: "Less brandable than pure letters" });
  }

  // 5. Pronounceability (simple heuristic: consonant-vowel patterns)
  const vowels = sldLower.replace(/[^aeiou]/g, "").length;
  const ratio = vowels / sldLower.length;
  if (ratio >= 0.3 && ratio <= 0.5 && isAllLetters) {
    score += 5;
    factors.push({ name: "Pronounceable", impact: "positive", description: "Good vowel-consonant balance" });
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Calculate estimated price range
  const baseMin = 5;
  const baseMax = 50;
  const multiplier = Math.pow(10, score / 25); // exponential scaling
  const min = Math.round(baseMin * multiplier * tldMultiplier);
  const max = Math.round(baseMax * multiplier * tldMultiplier);

  // Determine tier
  let tier: ValuationResult["tier"];
  if (score >= 80) tier = "premium";
  else if (score >= 65) tier = "high";
  else if (score >= 45) tier = "medium";
  else if (score >= 25) tier = "low";
  else tier = "minimal";

  return {
    score,
    estimatedRange: { min, max },
    factors,
    tier,
  };
}
