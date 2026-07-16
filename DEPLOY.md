# 部署指南：从 FTP 迁移到 Cloudflare Pages

> 当前生产部署走 FTP（`.github/workflows/deploy.yml`）。本文件是把站点迁到
> **Cloudflare Pages** 的步骤，换取：**原子部署**（旧版到新版瞬间切换，无半成品）、
> **全球边缘缓存**（`public/_headers` 控制策略）、**每 PR 预览部署**、**一键回滚**。
>
> Cloudflare Pages 免费额度（500 次/月构建、无限请求、无限静态资源）对本站绰绰有余。

---

## 前置准备（一次性）

1. 注册/登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages。
2. **创建 Pages 项目** `cybergo-docs`：
   - 方式 A（推荐，自动 PR 预览）：点「Create application」→ 连接 Git 仓库
     `cybergodev/docs-site` → framework 选 `Vite`（或 None）→ build command
     `npm run build` → output directory `docs/.vitepress/dist`。
   - 方式 B（CI 部署，用本仓库的 `.github/workflows/deploy-cloudflare.yml`）：
     先创建一个空项目（Direct Upload 模式），CI 推 dist 上去。
3. **生成 API Token**（方式 B 必需）：Cloudflare → My Profile → API Tokens →
   「Edit Cloudflare Workers」模板（含 Cloudflare Pages:Edit 权限），记下 token。
4. **记下 Account ID**：Dashboard 右侧栏或 Pages 项目设置里。

## 配置 GitHub Secrets（方式 B）

仓库 Settings → Secrets and variables → Actions，加：

| Secret | 值 |
|--------|----|
| `CLOUDFLARE_API_TOKEN` | 上一步生成的 token |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Cloudflare account ID |

## DNS：把 `www.cybergo.dev` 指向 Pages

在 Cloudflare 的 DNS 面板为 `www.cybergo.dev` 加 **CNAME → `cybergo-docs.pages.dev`**
（或在 Pages 项目 → Custom domains 绑定 `www.cybergo.dev`，Cloudflare 自动配 DNS + 证书）。
`HOST` 常量在 `docs/.vitepress/shared.ts`，已是 `https://www.cybergo.dev`，无需改。

---

## 切换流程

1. **先验证**：手动触发 `Deploy to Cloudflare Pages` workflow（Actions 页 → Run workflow），
   确认 `cybergo-docs.pages.dev` 预览域名能正常访问、样式/搜索/重定向都 OK。
2. **绑定自定义域**，确认 `www.cybergo.dev` 经 Cloudflare 正常。
3. **切换生产触发**：编辑 `.github/workflows/deploy-cloudflare.yml`，取消注释 `push:` 块。
4. **停掉 FTP**：删除或禁用 `.github/workflows/deploy.yml`，避免双部署。
5. （方式 A 用户跳过 3）dashboard 连 Git 后，push main 自动生产部署。

> 切换期间可双跑（FTP 仍是真相源），Cloudflare 仅作预览。确认无误再切 DNS/触发。

## 每 PR 预览

- **方式 A**（dashboard 连 Git）：自动——每个 PR 生成一个 `<hash>.cybergo-docs.pages.dev`
  预览，PR 里贴评论链接，review 时直接看渲染效果。
- **方式 B**（CI）：需在 `deploy-cloudflare.yml` 加一个 `pull_request` 触发的 job，
  `--branch=<pr-branch>` 部署到预览环境（非 production 分支自动算预览）。

## 缓存策略

见 `public/_headers`：HTML / 镜像 `.md` / `llms*.txt` 默认 `must-revalidate`（每次回源校验），
`/assets/*`（Vite hash 资源）`immutable` 1 年，图片/字体 1 周。改了缓存策略后重新部署即生效。

## 回滚

Cloudflare Pages 每次部署是独立 immutable 版本。Dashboard → 项目 → Deployments →
任意历史版本 →「Rollback to this deployment」，一键回滚（FTP 无此能力）。

## 成本

免费额度：500 次构建/月、无限请求/带宽。本站构建 ~3 分钟，月部署次数远低于上限。

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `.github/workflows/deploy-cloudflare.yml` | Cloudflare Pages 部署 workflow（默认手动触发） |
| `.github/workflows/deploy.yml` | 旧 FTP 部署（切换后删除） |
| `public/_headers` | Cloudflare Pages 缓存/安全头（VitePress 复制到 dist 根） |
| `docs/.vitepress/shared.ts` | `HOST` 常量（`https://www.cybergo.dev`） |
