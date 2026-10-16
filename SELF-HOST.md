# 自建部署改动说明

本 fork 只做"自建（自己搭前端 + 自己的后端）"所必需的改动，最小化 diff，方便跟上游同步。

## 改了什么

| 文件 | 改动 | 原因 |
|---|---|---|
| `webpack.config.js` | `BACKEND_BASE_URL` 默认值由 `https://back.ddct.top` 改为空 | 不再把作者后端写死进产物 |
| `webpack.config.js` | 删掉 PNG 的 `publicPath: 'https://www.ddct.top/'` | 图标改走 `output.publicPath: './'`，不再依赖作者站点 |
| `webpack.config.js` | dev server 的 `/api` 代理默认目标改为 `http://127.0.0.1:12345` | 本地开发时直接打自己后端；仍可用 `BACKEND_PROXY` 覆盖 |
| `src/services/backendConfig.ts` | 生产模式下未配置后端地址时，回退到**同源** `window.location.origin` | 前端与后端同域部署（`/api/*` 反向代理），换域名无需重新打包 |
| `index.html` | 删除 Turnstile SDK 的静态 `<script>` 与内联回调 | 自建后端 `GET /api/v1/auth/security-settings` 返回 `turnstile_enabled=false`，登录页不会渲染人机验证 |
| `src/services/security/turnstile.ts` | 改为**按需加载** SDK（含 250ms 兜底轮询） | 去掉静态引入后，若后端确实开启了验证，行为与原来一致 |
| `index.html` | favicon 改为相对路径；canonical 加注释提示自行修改 | 不再指向作者站点 |

行为不变的部分：后端连不上时，模式选择页的"云端修行"仍会走原来的降级逻辑
（`fetchBackendVersion()` 失败 → 卡片置灰显示"仙门未启 · 暂不可入"），单机模式完全不受影响。

## 怎么用

1. 后端按 https://github.com/<你>/xiantu-server 部署（FastAPI + SQLite，默认端口 12345）。
2. 构建前端：

   ```bash
   npm ci
   # 想让产物写死某个后端地址时可以指定；不指定就用同源
   # BACKEND_PROXY=https://api.example.com npm run build
   npm run build      # 产物在 dist/
   ```

3. 把 `dist/` 放到站点根目录，反向代理把 `/api/*` 交给后端：

   ```caddy
   xiantu.example.com {
       handle /api/* { reverse_proxy 127.0.0.1:12345 }
       handle { root * /var/www/xiantu; file_server; encode zstd gzip }
   }
   ```

4. 想进一步摆脱 CDN（Google Fonts / unpkg / jsdelivr 在国内常不稳），把字体与前端库下到站内即可，
   脚本与步骤见后端仓库的 `frontend-selfhost/`。

## 还没做（按需）

- 页面里的赞助二维码、"友情链接"等仍指向作者站点（属于作者署名，未改动）。
- `index.html` 的 Google Fonts、Font Awesome、unpkg 仍走 CDN，需要离线可用时再本地化。
