import { readFileSync } from "node:fs";

function flatten(value, prefix = "", out = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object") {
      flatten(child, path, out);
    } else {
      out[path] = true;
    }
  }
  return out;
}

const zh = flatten(JSON.parse(readFileSync("messages/zh-CN.json", "utf8")));
const en = flatten(JSON.parse(readFileSync("messages/en.json", "utf8")));

const missingInEn = Object.keys(zh).filter((key) => !(key in en));
const missingInZh = Object.keys(en).filter((key) => !(key in zh));

if (missingInEn.length > 0 || missingInZh.length > 0) {
  if (missingInEn.length > 0) {
    console.error(`en.json 缺少 key:\n${missingInEn.map((key) => `  - ${key}`).join("\n")}`);
  }
  if (missingInZh.length > 0) {
    console.error(`zh-CN.json 缺少 key:\n${missingInZh.map((key) => `  - ${key}`).join("\n")}`);
  }
  process.exit(1);
}

console.log(`i18n key 一致性检查通过（共 ${Object.keys(zh).length} 个 key）`);
