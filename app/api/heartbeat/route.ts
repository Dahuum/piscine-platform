import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/pg-pool";

export async function POST(req: NextRequest) {
  try {
    const { visitor } = await req.json();
    const pool = getPool();
    await pool.query(
      `INSERT INTO online_visitors (visitor_id, last_seen) VALUES ($1, now())
       ON CONFLICT (visitor_id) DO UPDATE SET last_seen = now()`,
      [visitor],
    );
    const { rows } = await pool.query(
      `SELECT count(*) FROM online_visitors WHERE last_seen > now() - interval '30 seconds'`,
    );
    return NextResponse.json({ online: Number(rows[0].count) });
  } catch {
    return NextResponse.json({ online: 0 });
  }
}
