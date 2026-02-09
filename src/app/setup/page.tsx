"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Globe, Bell, Clock, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";

const STEPS = [
  { title: "Welcome", icon: Globe },
  { title: "Add Domains", icon: Globe },
  { title: "Notifications", icon: Bell },
  { title: "Check Interval", icon: Clock },
  { title: "Done", icon: CheckCircle },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Domain step
  const [singleDomain, setSingleDomain] = useState("");
  const [bulkDomains, setBulkDomains] = useState("");
  const [addedDomains, setAddedDomains] = useState<string[]>([]);
  const [addingDomain, setAddingDomain] = useState(false);

  // Notification step
  const [notifType, setNotifType] = useState("webhook");
  const [notifName, setNotifName] = useState("");
  const [notifUrl, setNotifUrl] = useState("");
  const [notifAdded, setNotifAdded] = useState(false);

  // Interval step
  const [interval, setInterval] = useState("60");

  const [finishing, setFinishing] = useState(false);

  const handleAddSingleDomain = async () => {
    if (!singleDomain.trim()) return;
    setAddingDomain(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: singleDomain.trim() }),
      });
      if (res.ok) {
        setAddedDomains((prev) => [...prev, singleDomain.trim()]);
        setSingleDomain("");
        toast.success("Domain added");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add domain");
      }
    } catch {
      toast.error("Failed to add domain");
    } finally {
      setAddingDomain(false);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkDomains
      .split(/[\n,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setAddingDomain(true);
    try {
      const res = await fetch("/api/domains/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: lines }),
      });
      if (res.ok) {
        const data = await res.json();
        setAddedDomains((prev) => [
          ...prev,
          ...lines.filter((_, i) => data.results?.[i]?.success !== false),
        ]);
        setBulkDomains("");
        toast.success(`Imported ${data.imported || lines.length} domains`);
      } else {
        toast.error("Bulk import failed");
      }
    } catch {
      toast.error("Bulk import failed");
    } finally {
      setAddingDomain(false);
    }
  };

  const handleAddNotification = async () => {
    if (!notifName.trim() || !notifUrl.trim()) return;
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: notifType,
          name: notifName,
          config: { url: notifUrl },
          notifyOn: ["available", "expiring_soon", "pending_delete"],
        }),
      });
      if (res.ok) {
        setNotifAdded(true);
        toast.success("Notification channel added");
      } else {
        toast.error("Failed to add channel");
      }
    } catch {
      toast.error("Failed to add channel");
    }
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      // Save interval setting
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_interval_minutes: interval,
          setup_completed: "true",
        }),
      });
      toast.success("Setup complete!");
      router.push("/");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`flex-1 h-1 rounded-full ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold font-mono tracking-tight">
                  NameDrop
                </h1>
                <p className="text-muted-foreground">
                  Self-hosted domain drop catching. Monitor domains you want,
                  get notified when they become available, and optionally
                  auto-register them.
                </p>
                <div className="space-y-2 text-sm text-left text-muted-foreground">
                  <p>With NameDrop you can:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Track domain lifecycle via RDAP (no API keys needed)</li>
                    <li>Get alerts when domains expire or become available</li>
                    <li>Send notifications via webhook, Telegram, email, or ntfy</li>
                    <li>Integrate with n8n for advanced automation</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 1: Add Domains */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Add Domains</h2>
                  <p className="text-sm text-muted-foreground">
                    Add the domains you want to monitor.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="example.com"
                    value={singleDomain}
                    onChange={(e) => setSingleDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSingleDomain()}
                  />
                  <Button onClick={handleAddSingleDomain} disabled={addingDomain}>
                    Add
                  </Button>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">
                    Or paste multiple domains (one per line or comma-separated)
                  </label>
                  <textarea
                    className="w-full h-24 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
                    placeholder={"domain1.com\ndomain2.net\ndomain3.io"}
                    value={bulkDomains}
                    onChange={(e) => setBulkDomains(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkImport}
                    disabled={addingDomain || !bulkDomains.trim()}
                    className="mt-1"
                  >
                    Import All
                  </Button>
                </div>

                {addedDomains.length > 0 && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">
                      Added {addedDomains.length} domain(s):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {addedDomains.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 bg-accent rounded text-xs font-mono"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Notifications */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Notifications</h2>
                  <p className="text-sm text-muted-foreground">
                    Set up a notification channel to get alerts. You can skip this
                    and configure it later in Settings.
                  </p>
                </div>

                {notifAdded ? (
                  <div className="text-center py-4">
                    <CheckCircle className="mx-auto text-green-400 mb-2" size={32} />
                    <p className="text-sm">Notification channel added!</p>
                    <p className="text-xs text-muted-foreground">
                      You can add more channels later in Settings.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-sm text-muted-foreground">Type</label>
                      <select
                        value={notifType}
                        onChange={(e) => setNotifType(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="webhook">Webhook (n8n, Zapier, etc.)</option>
                        <option value="ntfy">ntfy (Push notifications)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Name</label>
                      <Input
                        value={notifName}
                        onChange={(e) => setNotifName(e.target.value)}
                        placeholder="e.g., My n8n Webhook"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">
                        {notifType === "ntfy" ? "ntfy URL (server/topic)" : "Webhook URL"}
                      </label>
                      <Input
                        value={notifUrl}
                        onChange={(e) => setNotifUrl(e.target.value)}
                        placeholder={
                          notifType === "ntfy"
                            ? "https://ntfy.sh/namedrop-alerts"
                            : "https://your-n8n.com/webhook/..."
                        }
                      />
                    </div>
                    <Button onClick={handleAddNotification}>
                      Add Channel
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Check Interval */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Check Interval</h2>
                  <p className="text-sm text-muted-foreground">
                    How often should NameDrop check your domains? The scheduler
                    automatically increases frequency for domains approaching
                    deletion.
                  </p>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">
                    Base interval (minutes)
                  </label>
                  <Input
                    type="number"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: 60 minutes for normal monitoring. Domains in
                    critical states (pending delete) are checked every 5 minutes
                    regardless.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Done */}
            {step === 4 && (
              <div className="text-center space-y-4">
                <CheckCircle className="mx-auto text-green-400" size={48} />
                <h2 className="text-lg font-semibold">All Set!</h2>
                <p className="text-sm text-muted-foreground">
                  NameDrop is ready to go. Your domains are being monitored and
                  you&apos;ll be notified of any status changes.
                </p>
                <Button onClick={handleFinish} disabled={finishing}>
                  {finishing ? "Setting up..." : "Go to Dashboard"}
                </Button>
              </div>
            )}

            {/* Navigation */}
            {step < 4 && (
              <div className="flex justify-between mt-6 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  <ArrowLeft size={16} className="mr-1" />
                  Back
                </Button>
                <Button onClick={() => setStep((s) => s + 1)}>
                  {step === 0 ? "Get Started" : "Next"}
                  <ArrowRight size={16} className="ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skip setup link */}
        {step < 4 && (
          <p className="text-center mt-4">
            <button
              onClick={handleFinish}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Skip setup and go to dashboard
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
