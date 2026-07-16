---
sidebar_label: "概览"
title: "API 参考 - CyberGo JWT | 完整接口文档"
description: "CyberGo JWT API 参考总览：导航至包级工厂函数、Processor 核心方法、Config 与 BlacklistConfig 配置、Claims 与 RegisteredClaims 声明、扩展接口、辅助类型与 19 个哨兵错误。"
sidebar_position: 1
---

# API 参考

CyberGo JWT 库提供完整的 JWT 令牌生命周期管理 API。

## 模块结构

| 模块 | 说明 | 详情 |
|------|------|------|
| [包函数](./functions) | `New`、`DefaultConfig`、`NewRateLimiter` 等工厂函数 | 构造与初始化 |
| [Processor](./processor) | 令牌创建、验证、刷新、吊销等核心方法 | 核心操作 |
| [Config](./config) | `Config`、`BlacklistConfig` 配置结构 | 配置管理 |
| [Claims](./claims) | `Claims`、`RegisteredClaims` 声明类型 | 令牌声明 |
| [接口定义](./interfaces) | `TokenManager`、`CustomClaims`、`BlacklistStore` 等 | 扩展接口 |
| [类型与常量](./types) | 签名算法常量、`NumericDate`、`StringOrSlice` 等 | 辅助类型 |
| [错误](./errors) | 19 个哨兵错误、`ValidationError` | 错误处理 |

## 快速查找

### 按使用场景

| 场景 | 相关 API |
|------|----------|
| 创建 Processor | [`jwt.New()`](./functions#new)、[`jwt.DefaultConfig()`](./functions#defaultconfig) |
| 签发令牌 | [`Processor.Create()`](./processor#create)、[`Processor.CreateRefresh()`](./processor#createrefresh) |
| 验证令牌 | [`Processor.Validate()`](./processor#validate)、[`Processor.ValidateInto()`](./processor#validateinto) |
| 刷新令牌 | [`Processor.Refresh()`](./processor#refresh)、[`Processor.RefreshInto()`](./processor#refreshinto) |
| 吊销令牌 | [`Processor.Revoke()`](./processor#revoke)、[`Processor.IsRevoked()`](./processor#isrevoked) |
| 配置签名算法 | [`Config.SigningMethod`](./config#config) |
| 自定义 Claims | [`CustomClaims`](./interfaces#customclaims) 接口 |
| 黑名单管理 | [`BlacklistStore`](./interfaces#blackliststore) 接口 |
| 限流保护 | [`RateLimitProvider`](./interfaces#ratelimitprovider) 接口 |
| 错误处理 | [`哨兵错误`](./errors#哨兵错误) |
