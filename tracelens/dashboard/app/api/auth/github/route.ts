import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { code, redirect_uri } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "Ov23li6PaJtcPOZK3dk2";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || "cd3142000b576279d38bef06ba8c5026fd04c4d7";

    const payload: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    };
    if (redirect_uri) {
      payload.redirect_uri = redirect_uri;
    }

    // 1. Exchange code for GitHub access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("GitHub access_token exchange failed:", tokenData);
      return NextResponse.json(
        { error: tokenData.error_description || tokenData.error || "Failed to exchange GitHub authorization code" },
        { status: 400 }
      );
    }

    // 2. Fetch authenticated GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "TraceLens-Dashboard",
      },
    });
    const userData = await userRes.json();

    // 3. Fetch user emails
    let email = userData.email;
    try {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "TraceLens-Dashboard",
        },
      });
      const emails = await emailRes.json();
      if (Array.isArray(emails)) {
        const primary = emails.find((e: any) => e.primary && e.verified) || emails[0];
        if (primary) email = primary.email;
      }
    } catch {
      // ignore
    }

    const finalEmail = email || `${userData.login}@github.com`;
    const jwtSecret = process.env.JWT_SECRET || "e4f3a7c89b0123456789abcdef0123456789abcdef0123456789abcdef012345";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const payloadJwt = Buffer.from(
      JSON.stringify({
        sub: "bbc90e75-0a99-4c66-8362-7f9d9678a819",
        email: finalEmail,
        name: userData.name || userData.login,
        iat: now,
        exp: now + 3600 * 24 * 7,
      })
    ).toString("base64url");
    const sig = crypto.createHmac("sha256", jwtSecret).update(header + "." + payloadJwt).digest("base64url");
    const token = `${header}.${payloadJwt}.${sig}`;

    return NextResponse.json({
      access_token: token,
      user_id: `u_gh_${userData.id}`,
      email: finalEmail,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url,
    });
  } catch (err: any) {
    console.error("GitHub auth error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
