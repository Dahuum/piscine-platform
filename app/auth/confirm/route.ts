import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Where Supabase sends the user after they click the confirmation link in
// the signup/reset-password/etc. email. Nothing on this site handled that
// link before this route existed — Supabase's mailer default template
// points at `{{ .SiteURL }}/auth/confirm?token_hash=...&type=...`, which
// 404'd because there was no /auth/confirm page at all.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";
  const redirectTo = new URL(next.startsWith("/") ? next : "/profile", origin);

  const supabase = await createServerSupabase();

  // Newer Supabase auth-template format: a one-time token verified directly
  // against the auth server (signup confirmation, magic link, password
  // recovery, email change).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  // PKCE-style flow: an authorization code to exchange for a session
  // (used for OAuth providers and some email link configurations).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  const errorUrl = new URL("/auth/error", origin);
  return NextResponse.redirect(errorUrl);
}
