"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DomainTable } from "@/components/DomainTable";
import { Search, Download, Upload } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Domain } from "@/lib/schema";
import { TagBadge } from "@/components/TagEditor";

interface RegistrarOption {
  adapterName: string;
  displayName: string;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [checking, setChecking] = useState<string | null>(null);
  const [registrars, setRegistrars] = useState<RegistrarOption[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchDomains = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (tagFilter) params.set("tag", tagFilter);
    const res = await fetch(`/api/domains?${params}`);
    const data = await res.json();
    setDomains(data);
    // Extract all unique tags from domains
    const tags = new Set<string>();
    data.forEach((d: Domain) => {
      try {
        const parsed = JSON.parse(d.tags || "[]") as string[];
        parsed.forEach((t) => tags.add(t));
      } catch { /* ignore */ }
    });
    setAllTags(Array.from(tags).sort());
    setLoading(false);
  }, [search, statusFilter, tagFilter]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // Fetch all tags once on mount (unfiltered)
  useEffect(() => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data: Domain[]) => {
        const tags = new Set<string>();
        data.forEach((d) => {
          try {
            const parsed = JSON.parse(d.tags || "[]") as string[];
            parsed.forEach((t) => tags.add(t));
          } catch { /* ignore */ }
        });
        setAllTags(Array.from(tags).sort());
      });
  }, []);

  // Fetch registrars on mount
  useEffect(() => {
    fetch("/api/registrars")
      .then((r) => r.json())
      .then((data) => {
        const configs = (data.configs || [])
          .filter((c: { enabled: boolean }) => c.enabled)
          .map((c: { adapterName: string; displayName: string }) => ({
            adapterName: c.adapterName,
            displayName: c.displayName,
          }));
        setRegistrars(configs);
      });
  }, []);

  const handleCheck = async (id: string) => {
    setChecking(id);
    try {
      const res = await fetch(`/api/domains/${id}/check`, { method: "POST" });
      const data = await res.json();
      toast.success(`Checked: ${data.status}`);
      await fetchDomains();
    } catch {
      toast.error("Check failed");
    } finally {
      setChecking(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this domain?")) return;
    await fetch(`/api/domains/${id}`, { method: "DELETE" });
    toast.success("Domain deleted");
    await fetchDomains();
  };

  const handleAutoRegChange = async (id: string, adapter: string) => {
    const body: Record<string, unknown> = {
      registrarAdapter: adapter || null,
      autoRegister: !!adapter,
    };
    const res = await fetch(`/api/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success(adapter ? `Auto-register via ${adapter}` : "Auto-register disabled");
      await fetchDomains();
    } else {
      toast.error("Failed to update auto-register");
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to add domain");
        return;
      }
      toast.success(`Added ${newDomain.trim()}`);
      setNewDomain("");
      await fetchDomains();
    } catch {
      toast.error("Failed to add domain");
    } finally {
      setAdding(false);
    }
  };

  const statuses = ["", "unknown", "registered", "expiring_soon", "grace_period", "redemption", "pending_delete", "available", "error"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Domains</h1>
          <p className="text-muted-foreground">Manage your domain watchlist</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => {
                const menu = document.getElementById("export-menu");
                menu?.classList.toggle("hidden");
              }}
            >
              <Download size={16} className="mr-2" />
              Export
            </Button>
            <div
              id="export-menu"
              className="hidden absolute right-0 mt-1 w-36 rounded-md border border-border bg-popover p-1 shadow-md z-10"
            >
              <a
                href="/api/domains/export?format=json"
                download
                className="block px-3 py-1.5 text-sm rounded hover:bg-accent"
              >
                Export JSON
              </a>
              <a
                href="/api/domains/export?format=csv"
                download
                className="block px-3 py-1.5 text-sm rounded hover:bg-accent"
              >
                Export CSV
              </a>
            </div>
          </div>
          <Link href="/domains/add">
            <Button variant="outline">
              <Upload size={16} className="mr-2" />
              Import
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleAddDomain} className="flex gap-3 max-w-lg">
        <Input
          placeholder="Add domain to watchlist..."
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          className="font-mono"
        />
        <Button type="submit" disabled={adding}>
          {adding ? "Adding..." : "Add"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Tags:</span>
          {tagFilter && (
            <button
              onClick={() => setTagFilter("")}
              className="text-xs px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60"
            >
              Clear
            </button>
          )}
          {allTags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
            />
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DomainTable
          domains={domains}
          onCheck={handleCheck}
          onDelete={handleDelete}
          checking={checking}
          registrars={registrars}
          onAutoRegChange={handleAutoRegChange}
        />
      )}
    </div>
  );
}
