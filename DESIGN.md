# CyberGo 文档站点设计规范

> **单一设计真相源（Single Source of Truth）。** 本文件沉淀站点所有视觉决策：颜色、间距、圆角、层级、明暗模式与组件约定。所有 AI 会话/人工改动外观时**先读本文件**，避免每个会话各自发挥导致视觉漂移。
>
> 代码层的真相源是 `docs/.vitepress/theme/style/tokens.css`；本文件是其语义说明与使用规则。二者必须同步——token 改了就改本文件，反之亦然。

---

## 1. 设计理念

| 原则 | 说明 |
|------|------|
| 开发者为中心 | 克制、信息密度优先，无装饰性插画/渐变英雄区 |
| 品牌色驱动 | NVIDIA 绿 `#76B900` 是唯一品牌色，贯穿交互元素 |
| 变量优先 | 所有颜色/间距/圆角**只引用 CSS 变量**，禁止硬编码字面量（`tokens.css` 定义 ramp 是唯一例外） |
| 明暗原生 | 深色模式是**重调色板**（retuned），不是简单反色；每个语义 token 必须明暗成对 |
| 不与 VitePress 对抗 | 优先复用 VitePress 内置变量（`--vp-c-*`），通过 bridge 映射品牌色，零逐组件覆盖 |

---

## 2. 颜色系统（三层架构）

实现在 `theme/style/tokens.css`。三层各司其职，**新增颜色需求按 1→2→3 顺序扩展**，不跳层。

### 第 1 层：原始色阶（RAW RAMP）— 品牌色 ingredients

NVIDIA 绿的 50→900 色阶。其中 **400/500/600/700 是原始精确品牌值，禁止微调**（视觉契约）：

| Token | 值 | 用途 |
|-------|----|------|
| `--cg-brand-50` | `#f7fcea` | 最浅背景 |
| `--cg-brand-100` | `#ecf9ce` | 浅背景 |
| `--cg-brand-200` | `#d9f09e` | — |
| `--cg-brand-300` | `#b8e355` | — |
| `--cg-brand-400` | `#8ed000` | **深色模式品牌色** |
| `--cg-brand-500` | `#76b900` | **浅色模式品牌色 / 主色** |
| `--cg-brand-600` | `#5a8b00` | 浅色 hover |
| `--cg-brand-700` | `#4a7500` | 浅色 pressed |
| `--cg-brand-800` | `#3a5c00` | — |
| `--cg-brand-900` | `#2b4400` | 最深 |

### 第 2 层：语义 token（SEMANTIC）— 带含义的 `--cg-*`

引用 ramp，**深色模式覆盖的是这层**（不是 ramp），所以深色是「更亮的品牌色」而非反色：

| Token | 浅色 | 深色 | 含义 |
|-------|------|------|------|
| `--cg-brand` | `brand-500` `#76b900` | `brand-400` `#8ed000` | 主品牌色（链接、主按钮、强调） |
| `--cg-brand-hover` | `brand-600` | `brand-500` | 悬停态 |
| `--cg-brand-pressed` | `brand-700` | `brand-600` | 按下态 |
| `--cg-brand-soft` | `rgba(118,185,0,.14)` | `rgba(142,208,0,.14)` | 品牌色弱背景（选中态、软高亮） |
| `--cg-brand-contrast` | `#ffffff` | `#ffffff` | 品牌填充面上的文字色 |
| `--cg-divider` | `rgba(118,185,0,.15)` | `rgba(142,208,0,.12)` | 品牌色分隔线 |

> 浅色 `default→hover→pressed` 沿 ramp **向下**（500→600→700，变深）；深色沿 ramp **向上**（400→500→600，变亮）——保证深色背景上的对比度。

### 第 3 层：VitePress 桥接（VP BRIDGE）— 让内置组件继承品牌

把 VitePress 的钩子变量映射到语义层，**所有内置组件零配置获得品牌色**：

```css
--vp-c-brand-1: var(--cg-brand);       /* 主交互色 */
--vp-c-brand-2: var(--cg-brand-hover);
--vp-c-brand-3: var(--cg-brand-pressed);
--vp-c-brand-soft: var(--cg-brand-soft);
--vp-c-accent: var(--cg-brand-500);
--vp-c-divider / --vp-c-gutter: var(--cg-divider);
```

> 文本/背景仍用 VitePress 原生 `--vp-c-text-1/2/3`、`--vp-c-bg`、`--vp-c-bg-soft` 等，无需自定义。

---

## 3. 设计 scale（间距 / 圆角 / 层级）

新增样式**只用 scale token**，禁止 magic number（现有字面量逐步迁移，不强行重写）：

### 间距（4px 基准）

| `--cg-sp-1` | `--cg-sp-2` | `--cg-sp-3` | `--cg-sp-4` | `--cg-sp-5` | `--cg-sp-6` |
|------------|------------|------------|------------|------------|------------|
| 4px | 8px | 12px | 16px | 24px | 32px |

### 圆角

| `--cg-radius-sm` | `--cg-radius-md` | `--cg-radius-lg` | `--cg-radius-pill` |
|------------------|------------------|------------------|--------------------|
| 4px | 8px | 16px | 9999px |

> `custom-block`（tip/warning/danger 容器）已统一用 `--cg-radius-md`。

### 层级（z-index）

| `--cg-z-base` | `--cg-z-dropdown` | `--cg-z-sticky` | `--cg-z-overlay` | `--cg-z-toast` |
|---------------|-------------------|-----------------|------------------|----------------|
| 1 | 10 | 100 | 1000 | 1100 |

---

## 4. 排版

当前**沿用 VitePress 默认排版**（系统字体栈 + Inter，代码块等宽），未定义自定义字体 token。`components.css` 中少量 `font-size` 字面量（如 footer `0.88rem`）属历史遗留。

**规则**：若未来需要统一字号/字重，应**新增 `--cg-font-*` token**（如 `--cg-font-size-body`、`--cg-font-weight-heading`）集中管理，不得在组件里散落硬编码 `rem`。

---

## 5. 组件约定

实现在 `theme/style/components.css`、`overrides.css`、`home.css`、`nav.css`。关键约定：

| 组件 | 约定 |
|------|------|
| 自定义页脚（`.site-footer`） | 背景用 `--vp-c-bg-soft`，分隔线 `--vp-c-divider`，链接悬停转 `--vp-c-brand-1`；最大宽度 1200px，4 列网格（2fr 1fr 1fr 1fr），≤960px 降 2 列、≤640px 降 1 列 |
| 文档反馈（`.doc-feedback`） | 圆角 10px（历史值，可迁移 `--cg-radius-md`=8px 或新增 token），激活态用 `--vp-c-brand-soft` 背景 + `--vp-c-brand-1` 文字 |
| 容器（tip/warning/danger/info） | VitePress 内置，圆角已 bridge 到 `--cg-radius-md`；颜色自动跟随 `--vp-c-brand-*` |
| 导航栏 | 毛玻璃效果（见 `nav.css`）；品牌色用于标题/GitHub 链接的交互态 |
| 代码块 | VitePress 默认 Shiki 主题；代码块标题/分组见 `overrides.css` 的 `vp-code-group` / `vp-code-title` 覆盖 |

---

## 6. 明暗模式工作流

新增任何颜色相关样式时**必须**：

1. 同时考虑浅色与深色下的可读性（不能只测一种）
2. 用语义 token（`--cg-*` / `--vp-c-*`）而非字面量，让 `.dark` 覆盖自动生效
3. 若引入全新颜色角色：先加 ramp 槽位 → 再加 `:root` 语义 token → 再加 `.dark` 对应覆盖 →（若影响内置组件）加 vp-bridge 映射

**禁止**：在组件 CSS 里写 `@media (prefers-color-scheme: dark)` 或硬编码 `.dark .my-comp { color: #xxx }`——一律走 token。

---

## 7. 新增样式 Checklist

改外观前逐条核对：

- [ ] 颜色只引用 `--cg-*` / `--vp-c-*`，无硬编码 hex（`tokens.css` 除外）
- [ ] 间距用 `--cg-sp-*`，圆角用 `--cg-radius-*`，层级用 `--cg-z-*`
- [ ] 浅色 + 深色都验证过对比度
- [ ] 新语义 token 在 `:root` 与 `.dark` 成对定义
- [ ] 改了 `tokens.css` 就同步改本文件
- [ ] 优先复用 VitePress 内置变量，覆盖走 vp-bridge 而非逐组件硬改

---

## 8. 相关文件

| 文件 | 作用 |
|------|------|
| `docs/.vitepress/theme/style/tokens.css` | 颜色/间距/圆角/层级 token 定义（代码层真相源） |
| `docs/.vitepress/theme/style/index.css` | 样式聚合入口，按 cascade 顺序 import |
| `docs/.vitepress/theme/style/{home,nav,overrides,components,utilities}.css` | 分层样式 |
| `DESIGN.md`（本文件） | 设计规范与使用规则（文档层真相源） |
