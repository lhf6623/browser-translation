// ========== 引擎注册表 ==========

import type { EngineState } from "./types";
import { tryGoogleTranslate } from "./google";
import { tryBaiduTranslate } from "./baidu";
import { tryYoudaoTranslate } from "./youdao";
import { tryTencentTranslate } from "./tencent";
import { tryMyMemory } from "./mymemory";

/** 按调度名称查找对应引擎函数 */
export function getTranslateFn(engineName: string) {
  switch (engineName) {
    case "GT":
      return tryGoogleTranslate;
    case "BD":
      return tryBaiduTranslate;
    case "YD":
      return tryYoudaoTranslate;
    case "TX":
      return tryTencentTranslate;
    default:
      return tryMyMemory;
  }
}
