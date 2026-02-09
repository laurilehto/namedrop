"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { TimelineEntry } from "@/components/TimelineEntry";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Domain, DomainHistoryEntry } from "@/lib/schema";

interface DomainDetail extends Domain {
  history: DomainHistoryEntry[];
}

export default function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [domain, setDomain] = useState<DomainDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch(`/api/domains/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setDomain(data);
        setNotes(data.notes || "");
      })
      .finally(() => setLoading(false));
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

  const handleDelete = async () => {
    if (!confirm("Delete this domain?")) return;
    await fetch(`/api/domains/${id}`, { method: "DELETE" });
    toast.success("Domain deleted");
    router.push("/domains");
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
