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

const zh = flatten(JSON.parse(readFileSync("apps/web/messages/zh-CN.json", "utf8")));
const en = flatten(JSON.parse(readFileSync("apps/web/messages/en.json", "utf8")));

const missingInEn = Object.keys(zh).filter((key) => !(key in en));
const missingInZh = Object.keys(en).filter((key) => !(key in zh));

if (missingInEn.length > 0 || missingInZh.length > 0) {
  if (missingInEn.length > 0) {
    console.error(`en.json is missing keys:\n${missingInEn.map((key) => `  - ${key}`).join("\n")}`);
  }
  if (missingInZh.length > 0) {
    console.error(`zh-CN.json is missing keys:\n${missingInZh.map((key) => `  - ${key}`).join("\n")}`);
  }
  process.exit(1);
}

console.log(`i18n key parity check passed (${Object.keys(zh).length} keys)`);
