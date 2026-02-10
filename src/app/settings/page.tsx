"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Webhook,
  Send,
  Mail,
  Bell,
  Plus,
  Pencil,
  Trash2,
  TestTube,
  Wallet,
  RefreshCw,
} from "lucide-react";

interface NotificationChannel {
  id: string;
  type: string;
  name: string;
  config: string;
  enabled: boolean;
  notifyOn: string;
  createdAt: string;
}

interface RegistrarConfigItem {
  id: string;
  adapterName: string;
  displayName: string;
  apiKey: string;
  apiSecret: string | null;
  sandboxMode: boolean;
  extraConfig: string;
  balance: number | null;
  balanceUpdated: string | null;
  enabled: boolean;
  createdAt: string;
}

interface AdapterType {
  name: string;
  displayName: string;
  configSchema: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    description: string;
    default?: string | number | boolean;
  }>;
}

const CHANNEL_TYPES = [
  { value: "webhook", label: "Webhook", icon: Webhook },
  { value: "telegram", label: "Telegram", icon: Send },
  { value: "email", label: "Email", icon: Mail },
  { value: "ntfy", label: "ntfy", icon: Bell },
];

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "grace_period", label: "Grace Period" },
  { value: "redemption", label: "Redemption" },
  { value: "pending_delete", label: "Pending Delete" },
  { value: "registered", label: "Registered" },
  { value: "registration_attempt", label: "Registration Attempt" },
  { value: "error", label: "Error" },
];

function getChannelIcon(type: string) {
  const ct = CHANNEL_TYPES.find((t) => t.value === type);
  return ct ? ct.icon : Webhook;
}

interface ChannelFormData {
  type: string;
  name: string;
  enabled: boolean;
  notifyOn: string[];
  url: string;
  botToken: string;
  chatId: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  to: string;
  serverUrl: string;
  topic: string;
}

const emptyForm: ChannelFormData = {
  type: "webhook",
  name: "",
  enabled: true,
  notifyOn: ["available", "expiring_soon"],
  url: "",
  botToken: "",
  chatId: "",
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPass: "",
  to: "",
  serverUrl: "https://ntfy.sh",
  topic: "",
};

interface RegistrarFormData {
  adapterName: string;
  displayName: string;
  apiKey: string;
  apiSecret: string;
  sandboxMode: boolean;
  extraConfig: Record<string, string>;
}

const emptyRegistrarForm: RegistrarFormData = {
  adapterName: "",
  displayName: "",
  apiKey: "",
  apiSecret: "",
  sandboxMode: true,
  extraConfig: {},
};

function formToConfig(form: ChannelFormData): Record<string, unknown> {
  switch (form.type) {
    case "webhook":
      return { url: form.url };
    case "telegram":
      return { botToken: form.botToken, chatId: form.chatId };
    case "email":
      return {
        smtpHost: form.smtpHost,
        smtpPort: parseInt(form.smtpPort) || 587,
        smtpUser: form.smtpUser,
        smtpPass: form.smtpPass,
        to: form.to,
      };
    case "ntfy":
      return { serverUrl: form.serverUrl, topic: form.topic };
    default:
      return {};
  }
}

function configToForm(
  channel: NotificationChannel
): Partial<ChannelFormData> {
  const config = JSON.parse(channel.config || "{}");
  const notifyOn = JSON.parse(channel.notifyOn || "[]");
  const base = {
    type: channel.type,
    name: channel.name,
    enabled: channel.enabled,
    notifyOn,
  };

  switch (channel.type) {
    case "webhook":
      return { ...base, url: config.url || "" };
    case "telegram":
      return {
        ...base,
        botToken: config.botToken || "",
        chatId: config.chatId || "",
      };
    case "email":
      return {
        ...base,
        smtpHost: config.smtpHost || "",
        smtpPort: String(config.smtpPort || 587),
        smtpUser: config.smtpUser || "",
        smtpPass: config.smtpPass || "",
        to: config.to || "",
      };
    case "ntfy":
      return {
        ...base,
        serverUrl: config.serverUrl || "https://ntfy.sh",
        topic: config.topic || "",
      };
    default:
      return base;
  }
}

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

  // Notification state
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChannelFormData>({ ...emptyForm });
  const [testing, setTesting] = useState<string | null>(null);
  const [channelSaving, setChannelSaving] = useState(false);

  // Registrar state
  const [registrars, setRegistrars] = useState<RegistrarConfigItem[]>([]);
  const [adapterTypes, setAdapterTypes] = useState<AdapterType[]>([]);
  const [regDialogOpen, setRegDialogOpen] = useState(false);
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [regForm, setRegForm] = useState<RegistrarFormData>({ ...emptyRegistrarForm });
  const [regSaving, setRegSaving] = useState(false);
  const [testingReg, setTestingReg] = useState<string | null>(null);
  const [checkingBalance, setCheckingBalance] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/scheduler").then((r) => r.json()),
      fetch("/api/notifications").then((r) => r.json()),
      fetch("/api/registrars").then((r) => r.json()),
    ]).then(([s, sch, ch, reg]) => {
      setSettings(s);
      setScheduler(sch);
      setChannels(ch);
      setRegistrars(reg.configs || []);
      setAdapterTypes(reg.adapterTypes || []);
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
    setScheduler((prev) =>
      prev
        ? { ...prev, lastResult: data, lastRun: new Date().toISOString() }
        : prev
    );
    toast.success(
      `Checked: ${data.checked}, Changed: ${data.changed}, Errors: ${data.errors}`
    );
  };

  // --- Notification Handlers ---
  const fetchChannels = async () => {
    const res = await fetch("/api/notifications");
    setChannels(await res.json());
  };

  const openAddDialog = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEditDialog = (channel: NotificationChannel) => {
    setEditingId(channel.id);
    setForm({ ...emptyForm, ...configToForm(channel) });
    setDialogOpen(true);
  };

  const handleChannelSave = async () => {
    setChannelSaving(true);
    try {
      const payload = {
        type: form.type,
        name: form.name,
        enabled: form.enabled,
        config: formToConfig(form),
        notifyOn: form.notifyOn,
      };

      if (editingId) {
        await fetch(`/api/notifications/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Channel updated");
      } else {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Channel created");
      }
      setDialogOpen(false);
      await fetchChannels();
    } catch {
      toast.error("Failed to save channel");
    } finally {
      setChannelSaving(false);
    }
  };

  const handleChannelDelete = async (id: string) => {
    if (!confirm("Delete this notification channel?")) return;
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    toast.success("Channel deleted");
    await fetchChannels();
  };

  const handleChannelToggle = async (channel: NotificationChannel) => {
    await fetch(`/api/notifications/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !channel.enabled }),
    });
    await fetchChannels();
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: id }),
      });
      if (res.ok) {
        toast.success("Test notification sent!");
      } else {
        const data = await res.json();
        toast.error(`Test failed: ${data.error}`);
      }
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(null);
    }
  };

  const toggleNotifyOn = (status: string) => {
    setForm((f) => ({
      ...f,
      notifyOn: f.notifyOn.includes(status)
        ? f.notifyOn.filter((s) => s !== status)
        : [...f.notifyOn, status],
    }));
  };

  // --- Registrar Handlers ---
  const fetchRegistrars = async () => {
    const res = await fetch("/api/registrars");
    const data = await res.json();
    setRegistrars(data.configs || []);
    setAdapterTypes(data.adapterTypes || []);
  };

  const openAddRegDialog = () => {
    setEditingRegId(null);
    const defaultAdapter = adapterTypes[0]?.name || "";
    setRegForm({
      ...emptyRegistrarForm,
      adapterName: defaultAdapter,
      displayName: adapterTypes[0]?.displayName || "",
    });
    setRegDialogOpen(true);
  };

  const openEditRegDialog = (reg: RegistrarConfigItem) => {
    let extra: Record<string, string> = {};
    try {
      extra = JSON.parse(reg.extraConfig || "{}");
    } catch {
      // ignore
    }
    setEditingRegId(reg.id);
    setRegForm({
      adapterName: reg.adapterName,
      displayName: reg.displayName,
      apiKey: "",
      apiSecret: "",
      sandboxMode: reg.sandboxMode,
      extraConfig: extra,
    });
    setRegDialogOpen(true);
  };

  const handleRegSave = async () => {
    setRegSaving(true);
    try {
      const payload: Record<string, unknown> = {
        adapterName: regForm.adapterName,
        displayName: regForm.displayName,
        sandboxMode: regForm.sandboxMode,
        extraConfig: regForm.extraConfig,
      };

      let res: Response;
      if (editingRegId) {
        if (regForm.apiKey) payload.apiKey = regForm.apiKey;
        if (regForm.apiSecret) payload.apiSecret = regForm.apiSecret;
        res = await fetch(`/api/registrars/${editingRegId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.apiKey = regForm.apiKey;
        if (regForm.apiSecret) payload.apiSecret = regForm.apiSecret;
        res = await fetch("/api/registrars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save registrar");
        return;
      }
      toast.success(editingRegId ? "Registrar updated" : "Registrar added");
      setRegDialogOpen(false);
      await fetchRegistrars();
    } catch {
      toast.error("Failed to save registrar");
    } finally {
      setRegSaving(false);
    }
  };

  const handleRegDelete = async (id: string) => {
    if (!confirm("Delete this registrar configuration?")) return;
    await fetch(`/api/registrars/${id}`, { method: "DELETE" });
    toast.success("Registrar deleted");
    await fetchRegistrars();
  };

  const handleRegToggle = async (reg: RegistrarConfigItem) => {
    await fetch(`/api/registrars/${reg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !reg.enabled }),
    });
    await fetchRegistrars();
  };

  const handleTestReg = async (id: string) => {
    setTestingReg(id);
    try {
      const res = await fetch(`/api/registrars/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Connection successful!");
      } else {
        toast.error(`Test failed: ${data.error}`);
      }
    } catch {
      toast.error("Test failed");
    } finally {
      setTestingReg(null);
    }
  };

  const handleCheckBalance = async (id: string) => {
    setCheckingBalance(id);
    try {
      const res = await fetch(`/api/registrars/${id}/balance`);
      const data = await res.json();
      if (data.error) {
        toast.error(`Balance check failed: ${data.error}`);
      } else {
        toast.success(`Balance: $${data.balance.toFixed(2)} ${data.currency}`);
        await fetchRegistrars();
      }
    } catch {
      toast.error("Balance check failed");
    } finally {
      setCheckingBalance(null);
    }
  };

  const selectedAdapterType = adapterTypes.find(
    (a) => a.name === regForm.adapterName
  );

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
            <label className="text-sm text-muted-foreground">
              Check Interval (minutes)
            </label>
            <Input
              type="number"
              value={settings.check_interval_minutes || "60"}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  check_interval_minutes: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              Expiring Threshold (days)
            </label>
            <Input
              type="number"
              value={settings.expiring_threshold_days || "30"}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  expiring_threshold_days: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              RDAP Timeout (ms)
            </label>
            <Input
              type="number"
              value={settings.rdap_timeout_ms || "10000"}
              onChange={(e) =>
                setSettings((s) => ({ ...s, rdap_timeout_ms: e.target.value }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Auto-Registration</label>
              <p className="text-xs text-muted-foreground">
                Automatically register domains when they become available
              </p>
            </div>
            <button
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  auto_register_enabled:
                    s.auto_register_enabled === "true" ? "false" : "true",
                }))
              }
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.auto_register_enabled === "true"
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                  settings.auto_register_enabled === "true"
                    ? "translate-x-5"
                    : ""
                }`}
              />
            </button>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              Low Balance Threshold ($)
            </label>
            <Input
              type="number"
              value={settings.low_balance_threshold || "10"}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  low_balance_threshold: e.target.value,
                }))
              }
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
                <span
                  className={
                    scheduler.active ? "text-green-400" : "text-red-400"
                  }
                >
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

      <Separator />

      {/* Registrar Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet size={16} />
            Registrar Accounts
          </CardTitle>
          <Button size="sm" onClick={openAddRegDialog}>
            <Plus size={14} className="mr-1" />
            Add Registrar
          </Button>
        </CardHeader>
        <CardContent>
          {registrars.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No registrar accounts configured. Add one to enable auto-registration.
            </p>
          ) : (
            <div className="space-y-3">
              {registrars.map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Wallet size={18} className="text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {reg.displayName}
                        </span>
                        <Badge variant={reg.enabled ? "default" : "secondary"}>
                          {reg.enabled ? "On" : "Off"}
                        </Badge>
                        {reg.sandboxMode && (
                          <Badge variant="outline" className="text-yellow-400 border-yellow-400/50">
                            Sandbox
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {reg.adapterName}
                        </span>
                        {reg.balance !== null && (
                          <span className="text-xs font-mono">
                            ${reg.balance.toFixed(2)}
                          </span>
                        )}
                        {reg.balanceUpdated && (
                          <span className="text-[10px] text-muted-foreground">
                            ({new Date(reg.balanceUpdated).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRegToggle(reg)}
                      title={reg.enabled ? "Disable" : "Enable"}
                    >
                      {reg.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestReg(reg.id)}
                      disabled={testingReg === reg.id}
                      title="Test connection"
                    >
                      <TestTube size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCheckBalance(reg.id)}
                      disabled={checkingBalance === reg.id}
                      title="Check balance"
                    >
                      <RefreshCw
                        size={14}
                        className={checkingBalance === reg.id ? "animate-spin" : ""}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditRegDialog(reg)}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRegDelete(reg.id)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Notification Channels
          </CardTitle>
          <Button size="sm" onClick={openAddDialog}>
            <Plus size={14} className="mr-1" />
            Add Channel
          </Button>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notification channels configured. Add one to get alerts when
              domain statuses change.
            </p>
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => {
                const Icon = getChannelIcon(channel.type);
                const notifyOn: string[] = JSON.parse(
                  channel.notifyOn || "[]"
                );
                return (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {channel.name}
                          </span>
                          <Badge
                            variant={
                              channel.enabled ? "default" : "secondary"
                            }
                          >
                            {channel.enabled ? "On" : "Off"}
                          </Badge>
                        </div>
                        <div className="flex gap-1 mt-1">
                          {notifyOn.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChannelToggle(channel)}
                        title={channel.enabled ? "Disable" : "Enable"}
                      >
                        {channel.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTest(channel.id)}
                        disabled={testing === channel.id}
                        title="Send test"
                      >
                        <TestTube size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(channel)}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChannelDelete(channel.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Channel" : "Add Notification Channel"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">
                Channel Type
              </label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {CHANNEL_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    onClick={() => setForm((f) => ({ ...f, type: ct.value }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs ${
                      form.type === ct.value
                        ? "border-primary bg-accent"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <ct.icon size={18} />
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Name</label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g., My Webhook"
              />
            </div>

            {form.type === "webhook" && (
              <div>
                <label className="text-sm text-muted-foreground">
                  Webhook URL
                </label>
                <Input
                  value={form.url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, url: e.target.value }))
                  }
                  placeholder="https://your-webhook-url.com/hook"
                />
              </div>
            )}

            {form.type === "telegram" && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Bot Token
                  </label>
                  <Input
                    value={form.botToken}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, botToken: e.target.value }))
                    }
                    placeholder="123456:ABC-DEF..."
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Chat ID
                  </label>
                  <Input
                    value={form.chatId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, chatId: e.target.value }))
                    }
                    placeholder="-1001234567890"
                  />
                </div>
              </>
            )}

            {form.type === "email" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      SMTP Host
                    </label>
                    <Input
                      value={form.smtpHost}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, smtpHost: e.target.value }))
                      }
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      SMTP Port
                    </label>
                    <Input
                      type="number"
                      value={form.smtpPort}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, smtpPort: e.target.value }))
                      }
                      placeholder="587"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    SMTP Username
                  </label>
                  <Input
                    value={form.smtpUser}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, smtpUser: e.target.value }))
                    }
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    SMTP Password
                  </label>
                  <Input
                    type="password"
                    value={form.smtpPass}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, smtpPass: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Recipient Email
                  </label>
                  <Input
                    value={form.to}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, to: e.target.value }))
                    }
                    placeholder="alerts@example.com"
                  />
                </div>
              </>
            )}

            {form.type === "ntfy" && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Server URL
                  </label>
                  <Input
                    value={form.serverUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serverUrl: e.target.value }))
                    }
                    placeholder="https://ntfy.sh"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Topic
                  </label>
                  <Input
                    value={form.topic}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, topic: e.target.value }))
                    }
                    placeholder="namedrop-alerts"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-sm text-muted-foreground">
                Notify on status changes
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleNotifyOn(opt.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.notifyOn.includes(opt.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleChannelSave} disabled={channelSaving}>
              {channelSaving
                ? "Saving..."
                : editingId
                  ? "Update"
                  : "Add Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar Add/Edit Dialog */}
      <Dialog open={regDialogOpen} onOpenChange={setRegDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRegId ? "Edit Registrar" : "Add Registrar Account"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">
                Adapter Type
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {adapterTypes.map((at) => (
                  <button
                    key={at.name}
                    onClick={() =>
                      setRegForm((f) => ({
                        ...f,
                        adapterName: at.name,
                        displayName: editingRegId ? f.displayName : at.displayName,
                      }))
                    }
                    disabled={!!editingRegId}
                    className={`flex flex-col items-center gap-1 p-3 rounded-md border text-xs ${
                      regForm.adapterName === at.name
                        ? "border-primary bg-accent"
                        : "border-border hover:bg-accent/50"
                    } ${editingRegId ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <Wallet size={18} />
                    {at.displayName}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">
                Display Name
              </label>
              <Input
                value={regForm.displayName}
                onChange={(e) =>
                  setRegForm((f) => ({ ...f, displayName: e.target.value }))
                }
                placeholder="e.g., My Dynadot Account"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">API Key</label>
              <Input
                type="password"
                value={regForm.apiKey}
                onChange={(e) =>
                  setRegForm((f) => ({ ...f, apiKey: e.target.value }))
                }
                placeholder={editingRegId ? "Leave blank to keep current" : "Enter API key"}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">
                API Secret (optional)
              </label>
              <Input
                type="password"
                value={regForm.apiSecret}
                onChange={(e) =>
                  setRegForm((f) => ({ ...f, apiSecret: e.target.value }))
                }
                placeholder={editingRegId ? "Leave blank to keep current" : "Enter API secret"}
              />
            </div>

            {/* Dynamic extra fields from adapter configSchema */}
            {selectedAdapterType?.configSchema.map((field) => (
              <div key={field.key}>
                <label className="text-sm text-muted-foreground">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <Input
                  type={field.type === "password" ? "password" : "text"}
                  value={regForm.extraConfig[field.key] || ""}
                  onChange={(e) =>
                    setRegForm((f) => ({
                      ...f,
                      extraConfig: { ...f.extraConfig, [field.key]: e.target.value },
                    }))
                  }
                  placeholder={field.description}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {field.description}
                </p>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Sandbox Mode</label>
                <p className="text-xs text-muted-foreground">
                  Use test/sandbox API endpoints
                </p>
              </div>
              <button
                onClick={() =>
                  setRegForm((f) => ({ ...f, sandboxMode: !f.sandboxMode }))
                }
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  regForm.sandboxMode ? "bg-yellow-500" : "bg-primary"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                    regForm.sandboxMode ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
            {!regForm.sandboxMode && (
              <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                Production mode - real domain registrations will be charged to your account!
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRegSave} disabled={regSaving}>
              {regSaving
                ? "Saving..."
                : editingRegId
                  ? "Update"
                  : "Add Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
