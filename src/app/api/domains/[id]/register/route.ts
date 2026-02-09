import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { attemptAutoRegistration } from "@/lib/registration";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const domain = await db
    .select()
    .from(domains)
    .where(eq(domains.id, id))
    .get();

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  if (domain.currentStatus !== "available") {
    return NextResponse.json(
      { error: "Domain is not available for registration" },
      { status: 400 }
    );
  }

  if (!domain.registrarAdapter) {
    return NextResponse.json(
      { error: "No registrar adapter assigned to this domain" },
      { status: 400 }
    );
  }

  try {
    await attemptAutoRegistration(domain);

    // Fetch updated domain
    const updated = await db
      .select()
      .from(domains)
      .where(eq(domains.id, id))
      .get();

    return NextResponse.json({
      success: updated?.currentStatus === "registered",
      domain: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed" },
      { status: 500 }
    );
  }
}
