import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "site/content";
const CJK = "\\u3400-\\u4dbf\\u4e00-\\u9fff";
const L = "A-Za-z0-9";
const sp = (s) => s
  .replace(new RegExp("([" + CJK + "])([" + L + "])", "g"), "$1 $2")
  .replace(new RegExp("([" + L + "])([" + CJK + "])", "g"), "$1 $2");

function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith(".md") ? [p] : []);
  });
}

let problems = 0;
const files = walk(ROOT);
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  let fm = 0, fence = false;
  lines.forEach((line, i) => {
    if (/^\s*---\s*$/.test(line) && fm < 2) { fm += 1; return; }
    if (fm < 2) { return; }
    if (/^\s*```/.test(line)) { fence = !fence; return; }
    if (fence || /^\s*:::/.test(line)) { return; }
    const where = relative(ROOT, f) + ":" + (i + 1);
    const q = line.match(/"[^"\n]{1,60}"/g);
    if (q) {
      q.forEach((s) => {
        if (/[\u4e00-\u9fa5]/.test(s)) {
          problems += 1;
          console.log("  ✗ " + where + "  ASCII 引号应用「」: " + s.slice(0, 40));
        }
      });
    }
    if (sp(line) !== line) {
      problems += 1;
      console.log("  ✗ " + where + "  中英之间缺空格: " + line.trim().slice(0, 46));
    }
  });
}
console.log("\n文案校对：" + files.length + " 个文件，" + (problems ? problems + " 处问题" : "未发现问题 ✓"));
process.exit(problems ? 1 : 0);