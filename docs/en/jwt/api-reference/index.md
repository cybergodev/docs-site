---
sidebar_label: "Overview"
title: "API Reference - CyberGo JWT | Interface Docs"
description: "CyberGo JWT API reference index linking to package factory functions, Processor methods, Config, Claims, RegisteredClaims, interfaces, types, and errors."
sidebar_position: 1
---

# API Reference

CyberGo JWT provides a complete JWT token lifecycle management API.

## Module Structure

| Module | Description | Details |
|--------|-------------|---------|
| [Package Functions](./functions) | `New`, `DefaultConfig`, `NewRateLimiter` and other factory functions | Construction & Initialization |
| [Processor](./processor) | Token creation, validation, refresh, and revocation core methods | Core Operations |
| [Config](./config) | `Config`, `BlacklistConfig` configuration structures | Configuration Management |
| [Claims](./claims) | `Claims`, `RegisteredClaims` claim types | Token Claims |
| [Interfaces](./interfaces) | `TokenManager`, `CustomClaims`, `BlacklistStore`, etc. | Extension Interfaces |
| [Types & Constants](./types) | Signing method constants, `NumericDate`, `StringOrSlice`, etc. | Auxiliary Types |
| [Errors](./errors) | **19** sentinel errors, `ValidationError` | Error Handling |

## Quick Lookup

### By Use Case

| Use Case | Related API |
|----------|-------------|
| Create Processor | [`jwt.New()`](./functions#new), [`jwt.DefaultConfig()`](./functions#defaultconfig) |
| Issue token | [`Processor.Create()`](./processor#create), [`Processor.CreateRefresh()`](./processor#createrefresh) |
| Validate token | [`Processor.Validate()`](./processor#validate), [`Processor.ValidateInto()`](./processor#validateinto) |
| Refresh token | [`Processor.Refresh()`](./processor#refresh), [`Processor.RefreshInto()`](./processor#refreshinto) |
| Revoke token | [`Processor.Revoke()`](./processor#revoke), [`Processor.IsRevoked()`](./processor#isrevoked) |
| Configure signing algorithm | [`Config.SigningMethod`](./config#config) |
| Custom Claims | [`CustomClaims`](./interfaces#customclaims) interface |
| Blacklist management | [`BlacklistStore`](./interfaces#blackliststore) interface |
| Rate limiting | [`RateLimitProvider`](./interfaces#ratelimitprovider) interface |
| Error handling | [`Sentinel Errors`](./errors#sentinel-errors) |
