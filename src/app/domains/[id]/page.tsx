"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { TimelineEntry } from "@/components/TimelineEntry";
import { ArrowLeft, RefreshCw, Trash2, Zap, Tag, DollarSign } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Domain, DomainHistoryEntry } from "@/lib/schema";
import { TagEditor } from "@/components/TagEditor";
import { estimateValue, type ValuationResult } from "@/lib/utils/valuation";

interface DomainDetail extends Domain {
  history: DomainHistoryEntry[];
}

interface RegistrarOption {
  adapterName: string;
  displayName: string;
  enabled: boolean;
}

export default function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [domain, setDomain] = useState<DomainDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [registrars, setRegistrars] = useState<RegistrarOption[]>([]);
  const [registering, setRegistering] = useState(false);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/domains/${id}`).then((r) => r.json()),
      fetch("/api/registrars").then((r) => r.json()),
    ]).then(([data, regData]) => {
      setDomain(data);
      setNotes(data.notes || "");
      try {
        setTags(JSON.parse(data.tags || "[]"));
      } catch {
        setTags([]);
      }
      setValuation(estimateValue(data.domain));
      const configs = (regData.configs || [])
        .filter((c: { enabled: boolean }) => c.enabled)
        .map((c: { adapterName: string; displayName: string; enabled: boolean }) => ({
          adapterName: c.adapterName,
          displayName: c.displayName,
          enabled: c.enabled,
        }));
      setRegistrars(configs);
      setLoading(false);
    });
  }, [id]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await fetch(`/api/domains/${id}/check`, { method: "POST" });
      const res = await fetch(`/api/domains/${id}`);
      const data = await res.json();
      setDomain(data);
      toast.success(`Status: ${data.currentStatus}`);
    } catch {
      toast.error("Check failed");
    } finally {
      setChecking(false);
    }
  };

  const handleSaveNotes = async () => {
    await fetch(`/api/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    toast.success("Notes saved");
  };

  const handleTagsChange = async (newTags: string[]) => {
    setTags(newTags);
    await fetch(`/api/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
  };

  const handleDelete = async () => {
    if (!confirm("Delete this domain?")) return;
    await fetch(`/api/domains/${id}`, { method: "DELETE" });
    toast.success("Domain deleted");
    router.push("/domains");
  };

  const handleAdapterChange = async (adapter: string) => {
    // Setting adapter also enables auto-register; clearing it disables auto-register
    const body: Record<string, unknown> = {
      registrarAdapter: adapter || null,
      autoRegister: !!adapter,
    };
    const res = await fetch(`/api/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const updated = await res.json();
    setDomain((d) => d ? { ...d, ...updated } : d);
    toast.success(adapter ? `Auto-register via ${adapter}` : "Auto-register disabled");
  };

  const handleRegisterNow = async () => {
    if (!confirm("Register this domain now? This will charge your registrar account.")) return;
    setRegistering(true);
    try {
      const res = await fetch(`/api/domains/${id}/register`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Domain registered successfully!");
        // Refresh domain data
        const domainRes = await fetch(`/api/domains/${id}`);
        setDomain(await domainRes.json());
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch {
      toast.error("Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!domain) {
    return <p className="text-muted-foreground">Domain not found</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/domains">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight font-mono">{domain.domain}</h1>
          <p className="text-muted-foreground">TLD: .{domain.tld}</p>
        </div>
        <StatusBadge status={domain.currentStatus} size="lg" />
      </div>

      <div className="flex gap-3">
        <Button onClick={handleCheck} disabled={checking}>
          <RefreshCw size={14} className={checking ? "animate-spin mr-2" : "mr-2"} />
          Check Now
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          <Trash2 size={14} className="mr-2" />
          Delete
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Registrar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{domain.registrar || "Unknown"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Expiry Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">
              {domain.expiryDate ? new Date(domain.expiryDate).toLocaleDateString() : "Unknown"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Last Checked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">
              {domain.lastChecked ? new Date(domain.lastChecked).toLocaleString() : "Never"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Valuation */}
      {valuation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign size={16} />
              Estimated Value
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-2xl font-bold font-mono">
                  ${valuation.estimatedRange.min.toLocaleString()} &ndash; ${valuation.estimatedRange.max.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Heuristic estimate only</p>
              </div>
              <div className="ml-auto text-right">
                <div className={`text-sm font-medium px-2.5 py-1 rounded-full ${
                  valuation.tier === "premium" ? "bg-green-500/20 text-green-400" :
                  valuation.tier === "high" ? "bg-blue-500/20 text-blue-400" :
                  valuation.tier === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                  valuation.tier === "low" ? "bg-orange-500/20 text-orange-400" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {valuation.tier.charAt(0).toUpperCase() + valuation.tier.slice(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Score: {valuation.score}/100
                </p>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  valuation.score >= 80 ? "bg-green-500" :
                  valuation.score >= 65 ? "bg-blue-500" :
                  valuation.score >= 45 ? "bg-yellow-500" :
                  valuation.score >= 25 ? "bg-orange-500" :
                  "bg-red-500"
                }`}
                style={{ width: `${valuation.score}%` }}
              />
            </div>
            <div className="space-y-1.5">
              {valuation.factors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 shrink-0 ${
                    f.impact === "positive" ? "text-green-400" :
                    f.impact === "negative" ? "text-red-400" :
                    "text-muted-foreground"
                  }`}>
                    {f.impact === "positive" ? "+" : f.impact === "negative" ? "-" : "="}
                  </span>
                  <div>
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground ml-1">{f.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-Registration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap size={16} />
            Auto-Registration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Auto-Register</p>
            <p className="text-xs text-muted-foreground mb-2">
              Select a registrar to automatically register when domain becomes available
            </p>
            <select
              value={domain.registrarAdapter || ""}
              onChange={(e) => handleAdapterChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Off</option>
              {registrars.map((r) => (
                <option key={r.adapterName} value={r.adapterName}>
                  {r.displayName}
                </option>
              ))}
            </select>
          </div>

          {domain.currentStatus === "available" && domain.registrarAdapter && (
            <Button
              onClick={handleRegisterNow}
              disabled={registering}
              className="w-full"
            >
              <Zap size={14} className="mr-2" />
              {registering ? "Registering..." : "Register Now"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag size={16} />
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TagEditor tags={tags} onChange={handleTagsChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Add notes about this domain..."
          />
          <Button size="sm" onClick={handleSaveNotes}>
            Save Notes
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Status History</CardTitle>
        </CardHeader>
        <CardContent>
          {domain.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet. Click &quot;Check Now&quot; to start.</p>
          ) : (
            <div>
              {domain.history.map((entry) => (
                <TimelineEntry
                  key={entry.id}
                  domain={domain.domain}
                  fromStatus={entry.fromStatus}
                  toStatus={entry.toStatus}
                  timestamp={entry.timestamp || ""}
                  eventType={entry.eventType}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
