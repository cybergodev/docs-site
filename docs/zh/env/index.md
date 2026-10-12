---
sidebar_label: "概述"
title: "环境变量管理 - CyberGo env | 安全环境变量配置"
description: "CyberGo env 是高安全 Go 环境变量管理库，支持 .env、JSON、YAML 多格式自动检测与类型安全转换，内置 SecureValue 安全存储、分片锁线程安全、变量展开与结构体映射，并提供完整审计日志。"
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

## 按场景导航

不知道从哪开始？按你的需求选择：

| 我想要... | 去哪里看 |
|-----------|---------|
| 5 分钟快速上手 | [快速开始](./getting-started/) |
| 安全存储密码、密钥 | [安全概述](./security/) → [SecureValue](./api-reference/secure-value) |
| 防止敏感数据交换到磁盘 | [内存锁定](./security/memory-locking) |
| 在日志中安全处理敏感数据 | [敏感数据脱敏](./security/data-masking) |
| 把环境变量映射到 struct | [结构体映射](./guides/struct-mapping) |
| 加载 JSON/YAML 配置文件 | [多格式配置](./guides/multi-format) |
| 配置变量引用与复用 | [变量展开](./guides/variable-expansion) |
| 序列化/导出配置 | [序列化](./guides/serialization) |
| 记录安全审计日志 | [审计日志](./guides/audit-logging) |
| 处理和匹配错误 | [错误处理](./guides/error-handling) |
| 编写单元测试 | [测试场景](./guides/testing) |
| 扩展自定义文件格式 | [自定义解析器](./guides/custom-parser) |
| 上线前安全检查 | [生产检查清单](./security/production-checklist) |
| 查看常用代码片段 | [速查表](./getting-started/cheatsheet) |
| 查找常见问题解答 | [FAQ](./reference/faq) |

## 主要功能概览

| 功能 | 说明 |
|------|------|
| [类型转换](./getting-started/) | GetString, GetInt, GetBool, GetDuration, GetSlice |
| [结构体映射](./guides/struct-mapping) | 标签驱动的配置绑定 |
| [安全存储](./api-reference/secure-value) | 敏感值内存保护 |
| [多格式加载](./guides/multi-format) | .env, JSON, YAML |

## 快速导航

### 入门
- [快速开始](./getting-started/) - 5 分钟上手教程
- [速查表](./getting-started/cheatsheet) - 常用代码片段

### API 参考
- [包函数](./api-reference/functions) - 完整 API 文档
- [Loader](./api-reference/loader) - 加载器方法
- [SecureValue](./api-reference/secure-value) - 安全值处理

### 安全
- [安全概述](./security/) - 安全架构与最佳实践
