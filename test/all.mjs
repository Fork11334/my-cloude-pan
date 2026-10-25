/* ==========================================================================
   测试入口：一次进程内跑完所有测试文件。
   为什么不用 `node --test test/`：测试运行器会为每个文件 spawn 子进程并用管道读输出，
   受限沙箱下这会直接 EPERM。这里改成同进程串行 import —— 零依赖，且跨平台一致。
   用法：node test/all.mjs   （npm test）
   ========================================================================== */

import './markdown.test.mjs';
import './content.test.mjs';
import './derive.test.mjs';
import './key.test.mjs';
import './accounts.test.mjs';
import './build.test.mjs';
import './archive.test.mjs';
import './game.test.mjs';
