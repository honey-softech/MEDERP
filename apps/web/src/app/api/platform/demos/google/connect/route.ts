import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/demo/google-calendar";
import { issueOauthState } from "@/lib/demo/oauth-state";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/platform/demos/settings?error=google-config", request.url));
  }
  const state = await issueOauthState(user.id);
  return NextResponse.redirect(googleAuthUrl(state, request));
}
