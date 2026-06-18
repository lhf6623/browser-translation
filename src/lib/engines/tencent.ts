// ========== 腾讯翻译引擎（代理，需要 SecretId + SecretKey 签名） ==========

import type { EngineDef } from "./types";
import { TX_SECRET_ID, TX_SECRET_KEY } from "../config";

async function hex256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash as ArrayBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac256(
  key: string | Uint8Array,
  msg: string,
): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    (typeof key === "string" ? new TextEncoder().encode(key) : key) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return new Uint8Array(sig);
}

async function hmac256hex(
  key: string | Uint8Array,
  msg: string,
): Promise<string> {
  const sig = await hmac256(key, msg);
  return Array.from(sig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const tencentDef: EngineDef = {
  name: "TX",

  buildPayload: async (text) => {
    const host = "tmt.tencentcloudapi.com";
    const service = "tmt";
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    const body = JSON.stringify({
      SourceText: text,
      Source: "en",
      Target: "zh",
      ProjectId: 0,
    });

    const hp = await hex256(body);
    const ch = `content-type:application/json\nhost:${host}\n`;
    const cr = `POST\n/\n\n${ch}\ncontent-type;host\n${hp}`;
    const hr = await hex256(cr);
    const cs = `${date}/${service}/tc3_request`;
    const sts = `TC3-HMAC-SHA256\n${timestamp}\n${cs}\n${hr}`;

    const sd = await hmac256("TC3" + TX_SECRET_KEY, date);
    const ss = await hmac256(sd, service);
    const ssk = await hmac256(ss, "tc3_request");
    const sig = await hmac256hex(ssk, sts);
    const auth = `TC3-HMAC-SHA256 Credential=${TX_SECRET_ID}/${cs}, SignedHeaders=content-type;host, Signature=${sig}`;

    return {
      url: `https://${host}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: host,
        "X-TC-Action": "TextTranslate",
        "X-TC-Version": "2018-03-21",
        "X-TC-Region": "ap-guangzhou",
        "X-TC-Timestamp": String(timestamp),
        Authorization: auth,
      },
      body,
    };
  },

  parseResponse: (data) => {
    const d = data as { Response?: { TargetText?: string; Error?: { Code?: string } } };
    const r = d.Response;
    if (!r || r.Error) return null;
    return r.TargetText ?? null;
  },

  isRateLimited: (data) => {
    const d = data as { Response?: { Error?: { Code?: string } } };
    const code = d.Response?.Error?.Code;
    return code === "LimitExceeded" || code === "RequestLimitExceeded";
  },
};
