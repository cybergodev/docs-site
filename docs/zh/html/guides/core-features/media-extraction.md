---
sidebar_label: "媒体提取实战"
title: "媒体提取实战 - CyberGo html | 视频与音频提取指南"
description: "CyberGo html 媒体提取实战指南：详解视频三源扫描机制（原始 HTML 扫描、DOM 遍历、正则兜底）与音频双源提取策略，解析 VideoInfo、AudioInfo 结构体字段含义、Type 字段区分文件来源与 embed 嵌入类型，并说明 .ogg 双重性及 Preserve 开关配置。"
sidebar_position: 2
---

# 媒体提取实战

除了文本、图片和链接，库还能从 HTML 中提取视频和音频资源。本指南详解提取机制与字段含义。

## 提取概览

调用 `Extract` 时，视频和音频提取在 DOM 解析之后、内容格式化之前执行。结果分别存入 `Result.Videos` 和 `Result.Audios`。

```text
DOM 解析 → 视频提取（3 源） → 音频提取（2 源） → 格式化 → Result
```

## 视频提取（三个来源）

视频提取按以下顺序执行，每个 URL 经过去重，不会重复收录：

| 顺序 | 来源 | 扫描对象 | 说明 |
|------|------|----------|------|
| ① | 原始 HTML 扫描 | `iframe`/`embed`/`object` 的 `src`/`data` 属性 | 在安全清洗**之前**执行，确保被清洗的嵌入标签不丢失 |
| ② | DOM 遍历 | `video`/`iframe`/`embed`/`object` 元素 | 遍历解析后的 DOM 树，读取元素属性和 `<source>` 子元素 |
| ③ | 正则兜底 | 视频文件 URL | 扫描 HTML 文本中的裸视频链接 |

:::tip 为什么要扫描原始 HTML
`iframe`、`embed`、`object` 等嵌入标签在安全清洗阶段可能被移除。库在清洗之前先从原始 HTML 字符串中提取这些标签的媒体 URL，确保嵌入视频不会因清洗而丢失。
:::

### 正则兜底支持的视频扩展名

```
.mp4  .webm  .ogg  .mov  .avi  .wmv  .flv  .mkv  .m4v  .3gp
```

正则仅匹配 `http://` 或 `https://` 开头的完整 URL，避免误匹配文件名片段。

## 音频提取（两个来源）

| 顺序 | 来源 | 扫描对象 | 说明 |
|------|------|----------|------|
| ① | DOM 遍历 | `audio` 元素及 `<source>` 子元素 | 读取 `src` 属性或子 `<source>` 的 `src`/`type` |
| ② | 正则兜底 | 音频文件 URL | 扫描 HTML 文本中的裸音频链接 |

### 正则兜底支持的音频扩展名

```
.mp3  .wav  .ogg  .m4a  .aac  .flac  .wma  .opus  .oga
```

:::warning .ogg 扩展名同时出现在视频和音频列表中
OGG 是一种容器格式，可承载视频（Theora）或音频（Vorbis/Opus）。扩展名 `.ogg` 的 URL 会被检测为**既是视频也是音频**，可能同时出现在 `Result.Videos` 和 `Result.Audios` 中。仅音频变体 `.oga` 只出现在音频列表中。
:::

## 字段详解

### VideoInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| `URL` | `string` | 视频源地址 |
| `Type` | `string` | 检测到的类型：MIME 类型（如 `video/mp4`）或 `embed`（iframe 嵌入页面） |
| `Poster` | `string` | `<video>` 的 `poster` 属性（封面图 URL） |
| `Width` | `string` | 宽度属性（原始字符串，未解析为数字） |
| `Height` | `string` | 高度属性（原始字符串，未解析为数字） |
| `Duration` | `string` | 时长属性（原始字符串，未解析为数字） |

### AudioInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| `URL` | `string` | 音频源地址 |
| `Type` | `string` | 检测到的类型：MIME 类型（如 `audio/mpeg`） |
| `Duration` | `string` | 时长属性（原始字符串，未解析为数字） |

### Type 字段的取值规则

`Type` 区分两类视频来源：

| Type 值 | 含义 | 产生场景 |
|---------|------|----------|
| `embed` | iframe 引用的视频页面 | YouTube、Vimeo、优酷、Bilibili 等嵌入式播放器 |
| MIME 类型（如 `video/mp4`） | 视频文件容器 | 正则兜底匹配的裸 URL，或 `<source type="...">` 属性值 |
| 空字符串 | 未检测到类型 | `<video src="...">` 直接指定源（无 `<source>` 子元素时） |

支持 `embed` 检测的嵌入平台：

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
	// 包含三种媒体场景的 HTML：
	// 1. iframe YouTube 嵌入（Type = "embed"）
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
	//   Type: embed, 尺寸: 560x315
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

## 配置控制

### Preserve* 选项

`PreserveVideos` 和 `PreserveAudios` 控制 `Extract` 结果中是否包含媒体：

| 配置字段 | 默认值 | 作用 |
|----------|--------|------|
| `PreserveVideos` | `true` | 为 `false` 时 `Result.Videos` 为空切片 |
| `PreserveAudios` | `true` | 为 `false` 时 `Result.Audios` 为空切片 |

```go
cfg := html.DefaultConfig()

// 禁用视频和音频提取（仅保留文本、图片、链接）
cfg.PreserveVideos = false
cfg.PreserveAudios = false

result, err := html.Extract(data, cfg)
// result.Videos → []
// result.Audios → []
```

### Preserve* 与 Include* 的区别

两组配置独立工作，控制不同的 API：

| 配置组 | 控制的 API | 说明 |
|--------|-----------|------|
| `PreserveVideos`/`PreserveAudios` | `Extract` | 控制 `Result.Videos`/`Result.Audios` 是否填充 |
| `IncludeVideos`/`IncludeAudios` | `ExtractAllLinks` | 控制链接枚举中是否包含视频/音频 URL |

:::warning 两者独立
关闭 `PreserveVideos` 不影响 `ExtractAllLinks` 中的 `IncludeVideos`，反之亦然。根据使用的 API 配置对应的选项。
:::

### TextOnlyConfig 性能预设

仅需文本时，`TextOnlyConfig()` 已禁用所有 `Preserve*` 选项，无需手动设置：

```go
cfg := html.TextOnlyConfig()
// PreserveImages = false
// PreserveLinks = false
// PreserveVideos = false
// PreserveAudios = false

result, err := html.Extract(data, cfg)
// 跳过所有媒体提取，最佳性能
```

## 下一步

- [内容提取实战](./content-extraction) - 提取流程与文章识别
- [输出格式实战](./output-formats) - 纯文本、Markdown、JSON 对比
- [API 参考：数据类型](../../api-reference/types/type-defs) - VideoInfo/AudioInfo 完整定义
