"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheduler, setScheduler] = useState<{
    running: boolean;
    active: boolean;
    lastRun: string | null;
    lastResult: { checked: number; changed: number; errors: number } | null;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/scheduler").then((r) => r.json()),
    ]).then(([s, sch]) => {
      setSettings(s);
      setScheduler(sch);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setSettings(data);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleManualRun = async () => {
    toast.info("Running scheduler...");
    const res = await fetch("/api/scheduler", { method: "POST" });
    const data = await res.json();
    setScheduler((prev) => prev ? { ...prev, lastResult: data, lastRun: new Date().toISOString() } : prev);
    toast.success(`Checked: ${data.checked}, Changed: ${data.changed}, Errors: ${data.errors}`);
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure NameDrop</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Check Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Check Interval (minutes)</label>
            <Input
              type="number"
              value={settings.check_interval_minutes || "60"}
              onChange={(e) => setSettings((s) => ({ ...s, check_interval_minutes: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Expiring Threshold (days)</label>
            <Input
              type="number"
              value={settings.expiring_threshold_days || "30"}
              onChange={(e) => setSettings((s) => ({ ...s, expiring_threshold_days: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">RDAP Timeout (ms)</label>
            <Input
              type="number"
              value={settings.rdap_timeout_ms || "10000"}
              onChange={(e) => setSettings((s) => ({ ...s, rdap_timeout_ms: e.target.value }))}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Scheduler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduler && (
            <div className="space-y-2 text-sm">
              <p>
                Status:{" "}
                <span className={scheduler.active ? "text-green-400" : "text-red-400"}>
                  {scheduler.active ? "Active" : "Inactive"}
                </span>
              </p>
              {scheduler.lastRun && (
                <p className="text-muted-foreground">
                  Last run: {new Date(scheduler.lastRun).toLocaleString()}
                </p>
              )}
              {scheduler.lastResult && (
                <p className="text-muted-foreground">
                  Last result: {scheduler.lastResult.checked} checked,{" "}
                  {scheduler.lastResult.changed} changed,{" "}
                  {scheduler.lastResult.errors} errors
                </p>
              )}
            </div>
          )}
          <Button variant="outline" onClick={handleManualRun}>
            Run Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
