import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains } from "@/lib/schema";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") || "json";
  const allDomains = await db.select().from(domains);

  if (format === "csv") {
    const headers = [
      "domain",
      "tld",
      "status",
      "expiry_date",
      "registrar",
      "priority",
      "tags",
      "notes",
      "added_at",
      "last_checked",
    ];
    const rows = allDomains.map((d) =>
      [
        d.domain,
        d.tld,
        d.currentStatus,
        d.expiryDate || "",
        d.registrar || "",
        String(d.priority || 0),
        `"${(d.tags || "[]").replace(/"/g, '""')}"`,
        `"${(d.notes || "").replace(/"/g, '""')}"`,
        d.addedAt || "",
        d.lastChecked || "",
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=namedrop-domains.csv",
      },
    });
  }

  // JSON format
  const exportData = allDomains.map((d) => ({
    domain: d.domain,
    tld: d.tld,
    status: d.currentStatus,
    expiryDate: d.expiryDate,
    registrar: d.registrar,
    priority: d.priority,
    tags: JSON.parse(d.tags || "[]"),
    notes: d.notes,
    addedAt: d.addedAt,
    lastChecked: d.lastChecked,
  }));

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=namedrop-domains.json",
    },
  });
}
