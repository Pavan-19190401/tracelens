import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Service account fallback for local & production
const FALLBACK_SA_PATH = "c:\\Users\\manik\\Downloads\\llm1-772fa-firebase-adminsdk-fbsvc-e6cc311c89.json";

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      // ignore
    }
  }
  if (fs.existsSync(FALLBACK_SA_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(FALLBACK_SA_PATH, "utf-8"));
    } catch {
      // ignore
    }
  }
  return null;
}

async function getGoogleAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    })
  ).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(header + "." + payload);
  const signature = sign.sign(sa.private_key, "base64url");
  const jwt = header + "." + payload + "." + signature;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description || "Failed to mint Google OAuth token");
  }
  return data.access_token;
}

export async function POST(req: Request) {
  try {
    const { phoneNumber } = await req.json();
    if (!phoneNumber) {
      return NextResponse.json({ error: "Missing phoneNumber" }, { status: 400 });
    }

    // Clean phone number: e.g. +919876543210
    const cleanPhone = phoneNumber.startsWith("+")
      ? `+${phoneNumber.slice(1).replace(/\D/g, "")}`
      : `+${phoneNumber.replace(/\D/g, "")}`;

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const sa = getServiceAccount();
    if (sa) {
      try {
        const accessToken = await getGoogleAccessToken(sa);

        // 1. Fetch current test phone numbers
        const configUrl = "https://identitytoolkit.googleapis.com/admin/v2/projects/llm1-772fa/config";
        const cfgRes = await fetch(configUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const cfg = await cfgRes.json();
        const testPhoneNumbers = cfg?.signIn?.phoneNumber?.testPhoneNumbers || {};

        // 2. Add or update current phone number
        testPhoneNumbers[cleanPhone] = otp;

        // 3. Update Firebase config so Firebase authenticates this number without billing restrictions
        const patchUrl = "https://identitytoolkit.googleapis.com/admin/v2/projects/llm1-772fa/config?updateMask=signIn";
        await fetch(patchUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signIn: {
              phoneNumber: {
                enabled: true,
                testPhoneNumbers,
              },
            },
          }),
        });
      } catch (adminErr) {
        console.warn("Could not patch Firebase test numbers via admin API:", adminErr);
      }
    }

    return NextResponse.json({
      success: true,
      phoneNumber: cleanPhone,
      otp,
      message: `Verification code generated for ${cleanPhone}`,
    });
  } catch (err: any) {
    console.error("Phone OTP error:", err);
    return NextResponse.json({ error: err.message || "Failed to dispatch OTP" }, { status: 500 });
  }
}
