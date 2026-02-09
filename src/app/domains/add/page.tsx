"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function AddDomainPage() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSingleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to add domain");
        return;
      }

      toast.success(`Added ${domain.trim()}`);
      router.push("/domains");
    } catch {
      toast.error("Failed to add domain");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/domains/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: bulkInput }),
      });

      const data = await res.json();
      toast.success(
        `Added: ${data.added.length}, Skipped: ${data.skipped.length}, Errors: ${data.errors.length}`
      );
      router.push("/domains");
    } catch {
      toast.error("Bulk import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Domains</h1>
        <p className="text-muted-foreground">Add domains to your watchlist</p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Add a domain</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSingleAdd} className="flex gap-3">
                <Input
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="font-mono"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding..." : "Add"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Bulk import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                placeholder={"example.com\nanother-domain.org\nmy-domain.io"}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                One domain per line, or comma-separated
              </p>
              <Button onClick={handleBulkAdd} disabled={loading}>
                {loading ? "Importing..." : "Import"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
