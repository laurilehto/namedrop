"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export default function AddDomainPage() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const doBulkImport = async (input: string) => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/domains/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
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

  const handleBulkAdd = () => doBulkImport(bulkInput);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      // For CSV files, extract first column (domain) skipping header if present
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) return;

      let domains: string[];
      const isCsv = file.name.endsWith(".csv") || text.includes(",");

      if (isCsv) {
        domains = lines.map((line) => {
          const cols = line.split(",");
          return cols[0].trim().replace(/^["']|["']$/g, "");
        });
        // Skip header if first entry doesn't look like a domain
        if (domains[0] && !/\.\w{2,}$/.test(domains[0])) {
          domains = domains.slice(1);
        }
      } else {
        domains = lines.map((l) => l.trim());
      }

      const input = domains.filter(Boolean).join("\n");
      setBulkInput(input);
      toast.info(`Loaded ${domains.filter(Boolean).length} domains from file`);
    };
    reader.readAsText(file);

    // Reset so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
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
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              >
                <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload a file</p>
                <p className="text-xs text-muted-foreground mt-1">
                  .txt, .csv, or .json
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">or paste below</span>
                </div>
              </div>
              <textarea
                placeholder={"example.com\nanother-domain.org\nmy-domain.io"}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                One domain per line, or comma-separated
              </p>
              <Button onClick={handleBulkAdd} disabled={loading || !bulkInput.trim()}>
                {loading ? "Importing..." : "Import"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
