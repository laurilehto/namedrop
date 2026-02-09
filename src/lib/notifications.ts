import { db } from "./db";
import { notificationChannels, domainHistory } from "./schema";
import { eq } from "drizzle-orm";
import type { Domain } from "./schema";

interface NotificationPayload {
  event: string;
  domain: string;
  previous_status: string | null;
  new_status: string;
  expiry_date: string | null;
  registrar: string | null;
  checked_at: string;
  auto_register: boolean;
  priority: number;
  tags: string[];
  message: string;
}

const STATUS_EMOJI: Record<string, string> = {
  available: "\u{1F7E2}",
  registered: "\u{1F534}",
  expiring_soon: "\u{1F7E1}",
  grace_period: "\u{1F7E0}",
  redemption: "\u{1F7E0}",
  pending_delete: "\u{1F535}",
  unknown: "\u26AA",
  error: "\u26AA",
};

function buildMessage(domain: string, newStatus: string): string {
  const emoji = STATUS_EMOJI[newStatus] || "";
  const labels: Record<string, string> = {
    available: "is now available!",
    registered: "is now registered",
    expiring_soon: "is expiring soon",
    grace_period: "entered grace period",
    redemption: "entered redemption period",
    pending_delete: "is pending deletion",
    unknown: "status is unknown",
    error: "check returned an error",
  };
  return `${emoji} ${domain} ${labels[newStatus] || `status changed to ${newStatus}`}`;
}

function buildPayload(
  domain: Domain,
  event: string,
  newStatus: string,
  previousStatus: string | null
): NotificationPayload {
  let tags: string[] = [];
  try {
    tags = JSON.parse(domain.tags || "[]");
  } catch {
    // ignore
  }

  return {
    event,
    domain: domain.domain,
    previous_status: previousStatus,
    new_status: newStatus,
    expiry_date: domain.expiryDate,
    registrar: domain.registrar,
    checked_at: new Date().toISOString(),
    auto_register: domain.autoRegister ?? false,
    priority: domain.priority ?? 0,
    tags,
    message: buildMessage(domain.domain, newStatus),
  };
}

async function sendWebhook(
  config: { url: string },
  payload: NotificationPayload
): Promise<void> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Webhook returned ${res.status}: ${await res.text()}`);
  }
}

async function sendTelegram(
  config: { botToken: string; chatId: string },
  payload: NotificationPayload
): Promise<void> {
  const text = [
    `*${payload.message}*`,
    "",
    `Domain: \`${payload.domain}\``,
    `Status: ${payload.previous_status || "unknown"} → ${payload.new_status}`,
    payload.expiry_date ? `Expiry: ${payload.expiry_date}` : null,
    payload.registrar ? `Registrar: ${payload.registrar}` : null,
    payload.tags.length > 0 ? `Tags: ${payload.tags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(
    `https://api.telegram.org/bot${config.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "Markdown",
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Telegram API returned ${res.status}: ${await res.text()}`);
  }
}

async function sendEmail(
  config: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    to: string;
  },
  payload: NotificationPayload
): Promise<void> {
  const net = await import("net");
  const tls = await import("tls");

  // Strip protocol prefix and trailing slashes from hostname
  const smtpHost = config.smtpHost
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const port = config.smtpPort;
  const useStartTLS = port === 587;
  const useImplicitTLS = port === 465;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("SMTP timeout after 30s"));
    }, 30000);

    let socket: import("net").Socket | import("tls").TLSSocket;
    let step = 0;
    let buffer = "";

    const commands = [
      `EHLO namedrop\r\n`,
      useStartTLS ? `STARTTLS\r\n` : null,
      `AUTH LOGIN\r\n`,
      `${Buffer.from(config.smtpUser).toString("base64")}\r\n`,
      `${Buffer.from(config.smtpPass).toString("base64")}\r\n`,
      `MAIL FROM:<${config.smtpUser}>\r\n`,
      `RCPT TO:<${config.to}>\r\n`,
      `DATA\r\n`,
      [
        `From: NameDrop <${config.smtpUser}>`,
        `To: ${config.to}`,
        `Subject: ${payload.message}`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `${payload.message}`,
        ``,
        `Domain: ${payload.domain}`,
        `Status: ${payload.previous_status || "unknown"} -> ${payload.new_status}`,
        payload.expiry_date ? `Expiry: ${payload.expiry_date}` : "",
        payload.registrar ? `Registrar: ${payload.registrar}` : "",
        payload.tags.length > 0 ? `Tags: ${payload.tags.join(", ")}` : "",
        ``,
        `-- NameDrop`,
        `.`,
        ``,
      ]
        .filter((l) => l !== "")
        .join("\r\n") + "\r\n",
      `QUIT\r\n`,
    ].filter(Boolean) as string[];

    function processLine(line: string) {
      const code = parseInt(line.substring(0, 3));
      if (line.charAt(3) === "-") return; // multiline response, wait for final

      if (code >= 400) {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error(`SMTP error ${code}: ${line}`));
        return;
      }

      // After STARTTLS 220 response, upgrade connection
      if (useStartTLS && step === 2 && code === 220) {
        socket = tls.connect({ socket: socket as import("net").Socket, servername: smtpHost }, () => {
          setupSocket(socket);
          // Re-send EHLO after TLS upgrade
          socket.write(`EHLO namedrop\r\n`);
        });
        return;
      }

      if (step < commands.length) {
        socket.write(commands[step]);
        step++;
      } else {
        clearTimeout(timeout);
        socket.destroy();
        resolve();
      }
    }

    function setupSocket(s: import("net").Socket | import("tls").TLSSocket) {
      s.setEncoding("utf8");
      s.on("data", (data: string) => {
        buffer += data;
        const lines = buffer.split("\r\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line) processLine(line);
        }
      });
      s.on("error", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    }

    if (useImplicitTLS) {
      socket = tls.connect(port, smtpHost, { servername: smtpHost }, () => {
        setupSocket(socket);
      });
    } else {
      socket = net.createConnection(port, smtpHost, () => {
        setupSocket(socket);
      });
    }
  });
}

async function sendNtfy(
  config: { serverUrl: string; topic: string },
  payload: NotificationPayload
): Promise<void> {
  const url = `${config.serverUrl.replace(/\/$/, "")}/${config.topic}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Title: `NameDrop: ${payload.domain}`,
      Priority: payload.new_status === "available" ? "high" : "default",
      Tags: payload.new_status === "available" ? "green_circle" : "information_source",
    },
    body: payload.message,
  });
  if (!res.ok) {
    throw new Error(`ntfy returned ${res.status}: ${await res.text()}`);
  }
}

type ChannelConfig = Record<string, unknown>;

const senders: Record<
  string,
  (config: ChannelConfig, payload: NotificationPayload) => Promise<void>
> = {
  webhook: (c, p) => sendWebhook(c as { url: string }, p),
  telegram: (c, p) =>
    sendTelegram(c as { botToken: string; chatId: string }, p),
  email: (c, p) =>
    sendEmail(
      c as {
        smtpHost: string;
        smtpPort: number;
        smtpUser: string;
        smtpPass: string;
        to: string;
      },
      p
    ),
  ntfy: (c, p) =>
    sendNtfy(c as { serverUrl: string; topic: string }, p),
};

export async function sendNotification(
  domain: Domain,
  event: string,
  newStatus: string,
  previousStatus: string | null,
  historyId?: string
): Promise<{ sent: number; errors: number }> {
  const result = { sent: 0, errors: 0 };

  try {
    const channels = await db
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.enabled, true));

    const payload = buildPayload(domain, event, newStatus, previousStatus);

    for (const channel of channels) {
      try {
        const notifyOn: string[] = JSON.parse(channel.notifyOn || "[]");
        if (!notifyOn.includes(newStatus)) continue;

        const config: ChannelConfig = JSON.parse(channel.config || "{}");
        const sender = senders[channel.type];
        if (!sender) {
          console.warn(`[NameDrop] Unknown notification channel type: ${channel.type}`);
          continue;
        }

        await sender(config, payload);
        result.sent++;
      } catch (err) {
        result.errors++;
        console.error(
          `[NameDrop] Failed to send notification via ${channel.type} (${channel.name}):`,
          err
        );
      }
    }

    // Mark history entry as notified
    if (historyId && result.sent > 0) {
      await db
        .update(domainHistory)
        .set({ notified: true })
        .where(eq(domainHistory.id, historyId));
    }
  } catch (err) {
    console.error("[NameDrop] Notification dispatch error:", err);
  }

  return result;
}

export async function sendTestNotification(channelId: string): Promise<void> {
  const channel = await db
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.id, channelId))
    .get();

  if (!channel) throw new Error("Channel not found");

  const config: ChannelConfig = JSON.parse(channel.config || "{}");
  const sender = senders[channel.type];
  if (!sender) throw new Error(`Unknown channel type: ${channel.type}`);

  const testPayload: NotificationPayload = {
    event: "test",
    domain: "example.com",
    previous_status: "registered",
    new_status: "available",
    expiry_date: new Date().toISOString(),
    registrar: "Test Registrar",
    checked_at: new Date().toISOString(),
    auto_register: false,
    priority: 0,
    tags: ["test"],
    message: "\u{1F7E2} example.com is now available! (test notification)",
  };

  await sender(config, testPayload);
}
