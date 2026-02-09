"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DomainTable } from "@/components/DomainTable";
import { Plus, Search, Download } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Domain } from "@/lib/schema";

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [checking, setChecking] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/domains?${params}`);
    const data = await res.json();
    setDomains(data);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

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
            <Button>
              <Plus size={16} className="mr-2" />
              Add Domain
            </Button>
          </Link>
        </div>
      </div>

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

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DomainTable
          domains={domains}
          onCheck={handleCheck}
          onDelete={handleDelete}
          checking={checking}
        />
      )}
    </div>
  );
}
