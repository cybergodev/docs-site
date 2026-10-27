---
sidebar_label: "媒体提取实战"
title: "媒体提取实战 - CyberGo html | 视频与音频提取指南"
description: "CyberGo html 媒体提取实战：Extract 的视频三个来源（原始 HTML 扫描、DOM 遍历、正则兜底）与音频两个来源、URL 去重规则、VideoInfo 与 AudioInfo 字段含义、Type 取值规则，以及 .ogg 双重收录与 Preserve 开关。"
sidebar_position: 20
---

# 媒体提取实战

`Extract` 在提取文本的同时提取视频与音频，结果写入 `Result.Videos` 与 `Result.Audios`。本页覆盖两者的来源、去重规则、字段含义与 `Type` 取值。

## 提取顺序

视频与音频提取在 DOM 解析与安全清洗之后执行，位于文本格式化与统计之后，是 `Result` 组装的收尾步骤；两种媒体共用一次 DOM 遍历：

```text
DOM 解析 → 安全清洗 → 文本格式化与统计 → 媒体提取（视频三个来源 / 音频两个来源，单遍 DOM 遍历） → Result
```

每个 URL 按种类去重，同一地址只收录一次。

## 视频提取（三个来源）

| 顺序 | 来源 | 扫描对象 | 说明 |
|------|------|----------|------|
| ① | 原始 HTML 扫描 | `iframe`/`embed` 的 `src`、`embed`/`object` 的 `data` | 扫描的是清洗前的原始 HTML 文本：这些嵌入标签已被清洗从 DOM 移除，只有原始文本里还留有它们的地址 |
| ② | DOM 遍历 | `video`/`iframe`/`embed`/`object` 元素 | 读取元素属性与 `<source>` 子元素 |
| ③ | 正则兜底 | HTML 文本中的裸视频 URL | 覆盖不构成媒体元素的引用，如注释或 JSON 负载里的地址 |

原始 HTML 扫描与正则兜底只在输入不超过 1,000,000 字节时执行，正则每种媒体最多匹配 1000 条；更大的文档只走 DOM 遍历。这两条路径还要求原始 HTML 中出现媒体特征（已知媒体扩展名或嵌入平台模式），纯文档页面不会触发扫描。

### 正则兜底支持的视频扩展名

```text
.mp4  .webm  .ogg  .mov  .avi  .wmv  .flv  .mkv  .m4v  .3gp
```

正则只匹配以 `http://` 或 `https://` 开头的完整 URL，不会把文件名片段当成资源。

## 音频提取（两个来源）

| 顺序 | 来源 | 扫描对象 | 说明 |
|------|------|----------|------|
| ① | DOM 遍历 | `audio` 元素及其 `<source>` 子元素 | 读取 `src` 属性，或子 `<source>` 的 `src`/`type` |
| ② | 正则兜底 | HTML 文本中的裸音频 URL | 与视频兜底同一机制 |

### 正则兜底支持的音频扩展名

```text
.mp3  .wav  .ogg  .m4a  .aac  .flac  .wma  .opus  .oga
```

:::warning .ogg 会同时进入 Videos 与 Audios
OGG 是容器格式，可承载视频（Theora）或音频（Vorbis/Opus），扩展名本身无法区分。因此 `.ogg` URL 会被判定为既是视频又是音频，同时出现在 `Result.Videos` 和 `Result.Audios` 中。仅音频的变体 `.oga` 只出现在音频列表。
:::

## 字段详解

### VideoInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| `URL` | `string` | 视频源地址 |
| `Type` | `string` | 容器类型：MIME 类型（如 `video/mp4`）或 `embed`（嵌入页面） |
| `Poster` | `string` | `<video>` 的 `poster` 属性（封面图 URL） |
| `Width` | `string` | 宽度属性，原始字符串 |
| `Height` | `string` | 高度属性，原始字符串 |
| `Duration` | `string` | 时长属性，原始字符串 |

### AudioInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| `URL` | `string` | 音频源地址 |
| `Type` | `string` | 容器类型：MIME 类型（如 `audio/mpeg`） |
| `Duration` | `string` | 时长属性，原始字符串 |

### Type 字段的取值规则

`Type` 按以下优先级确定：

1. 标记中显式声明了 `type` → 用声明值：`<embed>`/`<object>` 取自身 `type`；`<video>`/`<audio>` 仅在自身没有 `src`、改用子元素取源时取该 `<source type>`。服务器可能提供与扩展名不符的容器，所以声明优先。
2. 否则按 URL 判定：扩展名可识别 → 对应 MIME 类型（`a.mp4` → `video/mp4`，`a.mp3` → `audio/mpeg`）；视频 URL 命中嵌入平台模式 → `embed`。`<video src="...">` 与 `<audio src="...">` 直接指定源时也走这条。
3. DOM 遍历读到的 `iframe` 记为 `embed`，因为 iframe 本身不是媒体容器。前提是 `src` 为视频 URL 或已知嵌入平台地址，否则该 iframe 不产生记录。该路径要求 iframe 留在 DOM 中；默认清洗会移除 iframe，故仅 `EnableSanitization = false` 的输入走这条。
4. 都不成立时为空字符串（如 `<video src="/stream/abc">`）。

:::warning 超过 1 MB 的文档会丢掉 iframe 里的媒体
原始 HTML 扫描与正则兜底受 1,000,000 字节上限约束，超过后不再执行。默认清洗又会从 DOM 中移除 `iframe`/`embed`/`object`，因此 DOM 遍历读不到这些元素；只有 `EnableSanitization = false` 时 iframe 才留在 DOM 里被遍历到。

两条路径叠加的结果是：默认配置下，超过 1 MB 的文档中写在 iframe 里的视频**不会被收录**（实测 1.44 MB 文档中 YouTube iframe 消失，而 `<video>` 仍在结果里）。`<video>`/`<audio>` 元素走 DOM 遍历，不受此影响。

需要处理大文档中的嵌入媒体时，拆小输入，或对可信输入关闭清洗。
:::

| Type 值 | 含义 | 产生场景 |
|---------|------|----------|
| `embed` | 嵌入页面，不是媒体文件 | `iframe`，或命中嵌入平台模式的 `<embed>`/`<object>`/裸 URL（YouTube、Vimeo、优酷、Bilibili 等） |
| MIME 类型（如 `video/mp4`） | 视频文件容器 | `<source type="...">`/`<embed type="...">`/`<object type="...">` 的声明值，或由扩展名推导 |
| 空字符串 | 未识别出类型 | URL 无可识别扩展名，且标记未声明 `type` |

支持 `embed` 判定的嵌入平台：

| 平台 | URL 模式 |
|------|----------|
| YouTube | `youtube.com/embed/`、`youtube-nocookie.com/embed/` |
| Vimeo | `player.vimeo.com/video/` |
| Dailymotion | `dailymotion.com/embed/` |
| 优酷 | `player.youku.com/` |
| 腾讯视频 | `v.qq.com/` |
| Bilibili | `bilibili.com/` |

## 完整示例

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	// 三种媒体场景：
	// 1. iframe 嵌入 YouTube（Type = "embed"，经原始 HTML 扫描得到）
	// 2. 原生视频带 <source> 子元素（Type 来自 type 属性）
	// 3. 音频带 <source> 子元素（Type 来自 type 属性）
	data := []byte(`<html><body><article>
        <h1>多媒体页面</h1>
        <p>本文介绍视频和音频技术。</p>
        <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315"></iframe>
        <video poster="poster.jpg" width="640" height="360">
            <source src="https://example.com/trailer.mp4" type="video/mp4">
        </video>
        <audio>
            <source src="https://example.com/episode.mp3" type="audio/mpeg">
        </audio>
    </article></body></html>`)

	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("视频数量：%d\n", len(result.Videos))
	// 视频数量：2

	for i, v := range result.Videos {
		fmt.Printf("  视频 %d: %s\n", i+1, v.URL)
		fmt.Printf("    Type: %s", v.Type)
		if v.Poster != "" {
			fmt.Printf(", 海报: %s", v.Poster)
		}
		if v.Width != "" || v.Height != "" {
			fmt.Printf(", 尺寸: %sx%s", v.Width, v.Height)
		}
		fmt.Println()
	}
	// 视频 1: https://www.youtube.com/embed/dQw4w9WgXcQ
	//   Type: embed
	// 视频 2: https://example.com/trailer.mp4
	//   Type: video/mp4, 海报: poster.jpg, 尺寸: 640x360

	fmt.Printf("\n音频数量：%d\n", len(result.Audios))
	// 音频数量：1

	for i, a := range result.Audios {
		fmt.Printf("  音频 %d: %s (Type: %s)\n", i+1, a.URL, a.Type)
	}
	// 音频 1: https://example.com/episode.mp3 (Type: audio/mpeg)
}
```

每条视频记录按 URL 去重；原始 HTML 扫描先于 DOM 遍历执行，同一地址以先命中路径的记录为准——扫描路径只填 `URL` 与 `Type`，上例第一条视频因此没有尺寸与海报。

## 配置控制

### Preserve* 选项

| 配置字段 | 默认值 | 作用 |
|----------|--------|------|
| `PreserveVideos` | `true` | 为 `false` 时 `Result.Videos` 保持为 nil，JSON 输出中省略该键 |
| `PreserveAudios` | `true` | 为 `false` 时 `Result.Audios` 保持为 nil，JSON 输出中省略该键 |

```go
cfg := html.DefaultConfig()

// 禁用视频和音频提取（仅保留文本、图片、链接）
cfg.PreserveVideos = false
cfg.PreserveAudios = false

result, err := html.Extract(data, cfg)
// result.Videos → nil
// result.Audios → nil
```

### Preserve* 与 Include* 的区别

两组配置独立工作，作用于不同的 API：

| 配置组 | 控制的 API | 说明 |
|--------|-----------|------|
| `PreserveVideos`/`PreserveAudios` | `Extract` | 控制 `Result.Videos`/`Result.Audios` 是否填充 |
| `IncludeVideos`/`IncludeAudios` | `ExtractAllLinks` | 控制链接枚举中是否包含视频/音频 URL |

:::warning 两组开关互不影响
关闭 `PreserveVideos` 不会改变 `ExtractAllLinks` 中的 `IncludeVideos`，反之亦然。按实际调用的 API 配置对应选项。
:::

### TextOnlyConfig 预设

只需要文本时，`TextOnlyConfig()` 已关闭全部 `Preserve*` 选项：

```go
cfg := html.TextOnlyConfig()
// PreserveImages = false
// PreserveLinks = false
// PreserveVideos = false
// PreserveAudios = false

result, err := html.Extract(data, cfg)
// 跳过全部媒体提取
```

该预设只改这四个 `Preserve*` 字段，`ExtractAllLinks` 的 `Include*` 过滤保持默认值。

## 下一步

- [内容提取实战](./content-extraction) - 提取流程与文章识别
- [输出格式实战](./output-formats) - 纯文本、Markdown、JSON 对比
- [API 参考：数据类型](../../api-reference/types/type-defs) - VideoInfo/AudioInfo 完整定义
