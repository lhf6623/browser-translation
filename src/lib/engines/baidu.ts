// ========== 百度翻译引擎（代理，需要 APP_ID + SECRET_KEY 签名） ==========

import type { EngineDef } from "./types";
import { BD_APPID, BD_KEY } from "../config";

// ---- MD5（仅百度签名用） ------------------------------------------------

function md5(s: string): string {
  const add = (a: number, b: number) => (a + b) & 0xffffffff;
  const rol = (v: number, n: number) => (v << n) | (v >>> (32 - n));

  // 四轮函数
  const F = (b: number, c: number, d: number) => (b & c) | (~b & d);
  const G = (b: number, c: number, d: number) => (b & d) | (c & ~d);
  const H = (b: number, c: number, d: number) => b ^ c ^ d;
  const I = (b: number, c: number, d: number) => c ^ (b | ~d);

  // 每轮的 x 索引、移位量、常量 T
  const X = [
    0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,   // F
    1,6,11,0,5,10,15,4,9,14,3,8,13,2,7,12,    // G
    5,8,11,14,1,4,7,10,13,0,3,6,9,12,15,2,    // H
    0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,    // I
  ];
  const S = [
    7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
    5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
    6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21,
  ];
  const T = [
    0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
    0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
    0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
    0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
    0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
    0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
    0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
    0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391,
  ];
  const fn = [F, G, H, I];

  // 处理一个 64 字节块
  function processBlock(blk: number[], st: number[]): void {
    let a = st[0], b = st[1], c = st[2], d = st[3];
    for (let i = 0; i < 64; i++) {
      const f = fn[i >> 4](b, c, d);
      const tmp = d;
      d = c;
      c = b;
      b = add(b, rol(add(add(a, f), add(blk[X[i]], T[i])), S[i]));
      a = tmp;
    }
    st[0] = add(a, st[0]);
    st[1] = add(b, st[1]);
    st[2] = add(c, st[2]);
    st[3] = add(d, st[3]);
  }

  // 主流程
  const len = s.length;
  // 预分配填充数组：ceil((len+8)/64) 个 64 字节块 × 16 个 32-bit 字
  const blockCount = ((len + 8) >> 6) + 1;
  const paddedLen = blockCount << 4;
  const padded = new Array<number>(paddedLen).fill(0);

  for (let i = 0; i < len; i += 4) {
    padded[i >> 2] =
      s.charCodeAt(i) |
      ((s.charCodeAt(i + 1) || 0) << 8) |
      ((s.charCodeAt(i + 2) || 0) << 16) |
      ((s.charCodeAt(i + 3) || 0) << 24);
  }
  padded[len >> 2] |= 0x80 << ((len % 4) << 3);
  padded[paddedLen - 2] = (len * 8) & 0xffffffff;
  padded[paddedLen - 1] = Math.floor(len / 0x20000000);

  const st = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let i = 0; i < paddedLen; i += 16) {
    processBlock(padded.slice(i, i + 16), st);
  }

  // 输出 hex
  const hex = (n: number) => {
    const h = "0123456789abcdef";
    let s = "";
    for (let j = 0; j < 4; j++) s += h[(n >> (j * 8 + 4)) & 0xf] + h[(n >> (j * 8)) & 0xf];
    return s;
  };
  return st.map(hex).join("");
}

// ---- 引擎定义 ------------------------------------------------------------

export const baiduDef: EngineDef = {
  name: "BD",

  buildPayload: (texts) => {
    const q = texts.join("\n");
    const salt = Date.now().toString();
    const sign = md5(BD_APPID + q + salt + BD_KEY);
    const url =
      `https://fanyi-api.baidu.com/api/trans/vip/translate` +
      `?q=${encodeURIComponent(q)}&from=en&to=zh` +
      `&appid=${BD_APPID}&salt=${salt}&sign=${sign}`;
    return { url };
  },

  parseResponse: (data) => {
    const d = data as { trans_result?: { dst: string }[] };
    if (!d.trans_result) return [];
    return d.trans_result.map((r) => r.dst);
  },

  isRateLimited: (data) => {
    const d = data as { error_code?: string };
    return d.error_code === "54003";
  },
};
