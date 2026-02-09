import { NextRequest, NextResponse } from "next/server";
import { sendTestNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { channelId } = body;

  if (!channelId) {
    return NextResponse.json(
      { error: "channelId is required" },
      { status: 400 }
    );
  }

  try {
    await sendTestNotification(channelId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test failed" },
      { status: 500 }
    );
  }
}
