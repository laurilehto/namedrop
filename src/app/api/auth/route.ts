import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "namedrop_auth";

function generateToken(password: string): string {
  let hash = 0;
  const str = `namedrop:${password}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `nd_${Math.abs(hash).toString(36)}`;
}

export async function POST(request: NextRequest) {
  const authPassword = process.env.AUTH_PASSWORD;
  if (!authPassword) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 400 });
  }

  const body = await request.json();
  const { password } = body;

  if (password !== authPassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = generateToken(authPassword);
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
