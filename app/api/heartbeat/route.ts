import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function POST(req: NextRequest) {
  try {
    const { visitor } = await req.json();
    const key = `visitor:${visitor}`;
    await kv.set(key, Date.now(), { ex: 30 });
    const keys = await kv.keys("visitor:*");
    return NextResponse.json({ online: keys.length });
  } catch {
    return NextResponse.json({ online: 0 });
  }
}
