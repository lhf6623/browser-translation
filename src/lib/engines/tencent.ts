// ========== 腾讯翻译引擎（代理，需要 SecretId + SecretKey 签名） ==========

import type { EngineDef } from "./types";
import { TX_SECRET_ID, TX_SECRET_KEY } from "../config";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const encoder = new TextEncoder();

function hex256(s: string): string {
  return bytesToHex(sha256(encoder.encode(s)));
}

function hmac256(key: string | Uint8Array, msg: string): Uint8Array {
  const keyBytes = typeof key === "string" ? encoder.encode(key) : key;
  return hmac(sha256, keyBytes, encoder.encode(msg));
}

function hmac256hex(key: string | Uint8Array, msg: string): string {
  return bytesToHex(hmac256(key, msg));
}

export const tencentDef: EngineDef = {
  name: "TX",

  buildPayload: async (texts) => {
    const host = "tmt.tencentcloudapi.com";
    const service = "tmt";
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    const body = JSON.stringify({
      SourceText: texts[0] ?? "",
      Source: "en",
      Target: "zh",
      ProjectId: 0,
    });

    const hp = hex256(body);
    const ch = `content-type:application/json\nhost:${host}\n`;
    const cr = `POST\n/\n\n${ch}\ncontent-type;host\n${hp}`;
    const hr = hex256(cr);
    const cs = `${date}/${service}/tc3_request`;
    const sts = `TC3-HMAC-SHA256\n${timestamp}\n${cs}\n${hr}`;

    const sd = hmac256("TC3" + TX_SECRET_KEY, date);
    const ss = hmac256(sd, service);
    const ssk = hmac256(ss, "tc3_request");
    const sig = hmac256hex(ssk, sts);
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
    if (!r || r.Error) return [null];
    return [r.TargetText ?? null];
  },

  isRateLimited: (data) => {
    const d = data as { Response?: { Error?: { Code?: string } } };
    const code = d.Response?.Error?.Code;
    return code === "LimitExceeded" || code === "RequestLimitExceeded";
  },

  // 腾讯 API 不支持批量，每次只发送 texts[0]
  maxBatchSize: () => 1,
};
