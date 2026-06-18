// ========== 引擎注册表 ==========
// 从"名字→函数"映射改为"名字→定义"映射
// 调度层通过 executeEngine(text, def) 统一调用

import type { EngineDef } from "./types";
import { myMemoryDef } from "./mymemory";
import { googleDef } from "./google";
import { baiduDef } from "./baidu";
import { youdaoDef } from "./youdao";
import { tencentDef } from "./tencent";

/** 所有引擎定义，按调度名称索引 */
const engineDefs: Record<string, EngineDef> = {
  MM: myMemoryDef,
  GT: googleDef,
  BD: baiduDef,
  YD: youdaoDef,
  TX: tencentDef,
};

/** 按调度名称查找引擎定义 */
export function getEngineDef(engineName: string): EngineDef {
  return engineDefs[engineName] ?? myMemoryDef;
}
