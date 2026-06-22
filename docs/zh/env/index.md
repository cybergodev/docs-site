---
title: "CyberGo env - 环境变量管理库"
description: "CyberGo env 是高安全 Go 环境变量管理库，支持 .env、JSON、YAML 多格式加载与类型安全转换，内置 SecureValue 内存保护和审计日志，让配置更安全可靠。"
---

# env

高安全性的 Go 环境变量管理库，支持 `.env`、JSON、YAML 多格式，提供线程安全、审计日志和安全存储功能。

## 核心特性

- **多格式支持** - `.env`、JSON、YAML 自动检测
- **类型安全** - 自动类型转换与验证
- **线程安全** - 分片锁实现的线程安全并发访问
- **安全存储** - 敏感值内存锁定、自动清零
- **审计日志** - 完整操作追踪
- **变量展开** - `${VAR}` 语法支持
- **结构体映射** - 标签驱动的配置绑定

## 主要功能概览

| 功能 | 说明 |
|------|------|
| [类型转换](/zh/env/getting-started) | GetString, GetInt, GetBool, GetDuration, GetSlice |
| [结构体映射](/zh/env/guides/struct-mapping) | 标签驱动的配置绑定 |
| [安全存储](/zh/env/api-reference/secure-value) | 敏感值内存保护 |
| [多格式加载](/zh/env/guides/multi-format) | .env, JSON, YAML |

## 快速导航

<div class="vp-features">

### 入门
- [快速开始](/zh/env/getting-started) - 5 分钟上手教程
- [速查表](/zh/env/cheatsheet) - 常用代码片段

### API 参考
- [包函数](/zh/env/api-reference/functions) - 完整 API 文档
- [Loader](/zh/env/api-reference/loader) - 加载器方法
- [SecureValue](/zh/env/api-reference/secure-value) - 安全值处理

### 安全
- [安全概述](/zh/env/security/) - 安全架构与最佳实践

</div>
