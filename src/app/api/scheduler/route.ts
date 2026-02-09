import { NextResponse } from "next/server";
import { getSchedulerStatus, runSchedulerCheck } from "@/lib/scheduler";

export async function GET() {
  const status = getSchedulerStatus();
  return NextResponse.json(status);
}

export async function POST() {
  const result = await runSchedulerCheck();
  return NextResponse.json(result);
}
