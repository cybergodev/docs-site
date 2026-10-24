---
sidebar_label: "概述"
title: "环境变量管理 - CyberGo env | 安全环境变量配置"
description: "CyberGo env 是高安全 Go 环境变量管理库，支持 .env、JSON、YAML 多格式自动检测与类型安全转换，内置 SecureValue 安全存储、分片锁线程安全、变量展开与结构体映射，并提供完整审计日志。"
---

# env

env 是 CyberGo 的 Go 环境变量管理库，加载 `.env`、JSON、YAML 三种配置文件，把值转换成 Go 类型，保护敏感值内存，并记录审计事件。

## 核心特性

- **多格式加载**：`.env`、JSON、YAML 按扩展名自动检测
- **类型安全**：取值时自动转换并校验
- **并发安全**：单个 `Loader` 可跨 goroutine 共享
- **安全存储**：敏感值内存锁定与清零
- **审计日志**：记录加载、写入与删除操作
- **变量展开**：支持 `${VAR}` 与 `${VAR:-default}`
- **结构体映射**：标签驱动的配置绑定

## 按场景导航

按需求选择入口：

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

## 从这里开始

- [快速开始](./getting-started/)：安装、加载 `.env` 文件、读取类型化值
- [速查表](./getting-started/cheatsheet)：一页纸代码片段
- [包函数](./api-reference/functions)：包级函数完整参考
- [Loader](./api-reference/loader)：实例方法与生命周期
- [SecureValue](./api-reference/secure-value)：安全值处理
- [安全概述](./security/)：安全架构与默认值
