import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "Ov23li6PaJtcPOZK3dk2";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || "cd3142000b576279d38bef06ba8c5026fd04c4d7";

    // 1. Exchange code for GitHub access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.json(
        { error: tokenData.error_description || "Failed to exchange GitHub authorization code" },
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
    const token = `tl_github_jwt_${Date.now()}`;

    return NextResponse.json({
      access_token: token,
      user_id: `u_gh_${userData.id}`,
      email: finalEmail,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
