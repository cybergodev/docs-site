---
sidebar_label: "Web 服务器集成"
title: "Web 服务器集成 - CyberGo JWT | 认证中间件与 RBAC"
description: "生产级 JWT Web 服务器集成示例：登录签发令牌对、Bearer 认证中间件、RBAC 角色控制、刷新端点、登出吊销与优雅关闭，并演示密钥与端口的配置注入，覆盖完整 HTTP 服务生命周期。"
sidebar_position: 15
check_code: false
---

# Web 服务器集成

本页演示如何将 CyberGo JWT 集成到生产级 HTTP 服务器，覆盖完整的认证生命周期：

- **认证流程**：登录签发访问令牌 + 刷新令牌
- **认证中间件**：从 `Authorization: Bearer` 头提取并验证令牌
- **RBAC 角色控制**：基于 `claims.Role` 的细粒度访问控制
- **令牌刷新**：用刷新令牌换取新的访问令牌
- **登出吊销**：将令牌加入黑名单使会话失效
- **优雅关闭**：捕获中断信号，安全释放资源

:::tip 完整源码
本页基于仓库内置示例 `examples/web-server/main.go`，可直接编译运行。
:::

## 1. 初始化 Processor

生产环境中，密钥必须来自环境变量，**禁止硬编码**。同时配置令牌 TTL、速率限制和黑名单：

```go
package main

import (
    "log"
    "os"
    "time"

    "github.com/cybergodev/jwt"
)

// processor 是包级 JWT processor，在 main 中初始化
// expiresInSeconds 从访问令牌 TTL 推导，返回给客户端作为 expires_in
var (
    processor        *jwt.Processor
    expiresInSeconds int
)

func main() {
    var err error
    processor, expiresInSeconds, err = newJWTProcessor()
    if err != nil {
        log.Fatalf("初始化 JWT processor 失败: %v", err)
    }
    defer processor.Close()
    log.Println("JWT processor 初始化完成")
}

// newJWTProcessor 从环境变量驱动的配置构建 processor
func newJWTProcessor() (*jwt.Processor, int, error) {
    // 密钥来自环境变量（生产安全，禁止硬编码）
    secretKey := os.Getenv("JWT_SECRET_KEY")
    if secretKey == "" {
        log.Println("警告：未设置 JWT_SECRET_KEY，使用演示密钥")
        // 回退密钥仅为演示，让示例可脱离环境变量独立运行；
        // 生产环境密钥必须来自环境变量或密钥管理服务
        secretKey = "Kx9#mP2$vL8@nQ5!wR7&tY3^uI6*oE4%aS1+dF0-gH9~jK2#bN5$cM8@xZ7&vB4!"
    }

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = secretKey
    cfg.AccessTokenTTL = 15 * time.Minute     // 访问令牌有效期 15 分钟
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour  // 刷新令牌有效期 7 天
    cfg.Issuer = "web-server-example"

    // 启用速率限制，防止暴力签发
    cfg.EnableRateLimit = true
    cfg.RateLimitRate = 100 // 每分钟最多 100 次
    cfg.RateLimitWindow = time.Minute

    // 配置黑名单（用于登出吊销）
    cfg.Blacklist = jwt.BlacklistConfig{
        MaxSize:           10000,
        CleanupInterval:   5 * time.Minute,
        EnableAutoCleanup: true,
    }

    p, err := jwt.New(cfg)
    if err != nil {
        return nil, 0, err
    }
    // expires_in 从实际 TTL 推导，避免与真实过期时间漂移
    return p, int(cfg.AccessTokenTTL.Seconds()), nil
}
```

:::warning 生产安全
密钥通过环境变量 `JWT_SECRET_KEY` 注入，不要写入源码或提交到版本控制。上方代码中的回退密钥仅是为了让示例脱离环境变量也能运行；生产环境应始终由环境变量或密钥管理服务提供，回退分支只保留告警日志即可。
:::

## 2. 登录端点（/login）

验证用户凭据后，同时签发短期访问令牌和长期刷新令牌，返回 `access_token` + `refresh_token` + `expires_in` 给客户端：

```go
type User struct {
    ID          string   `json:"id"`
    Username    string   `json:"username"`
    Email       string   `json:"email"`
    Role        string   `json:"role"`
    Permissions []string `json:"permissions"`
}

type LoginRequest struct {
    Username string `json:"username"`
    Password string `json:"password"`
}

type LoginResponse struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    TokenType    string `json:"token_type"`
    ExpiresIn    int    `json:"expires_in"`
    User         User   `json:"user"`
}

type ErrorResponse struct {
    Error   string `json:"error"`
    Message string `json:"message"`
}

// sendError 发送 JSON 错误响应
func sendError(w http.ResponseWriter, status int, errorCode, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(ErrorResponse{Error: errorCode, Message: message})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        sendError(w, http.StatusMethodNotAllowed, "method_not_allowed", "仅支持 POST 方法")
        return
    }

    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        sendError(w, http.StatusBadRequest, "invalid_request", "JSON 格式无效")
        return
    }

    // 验证用户凭据（此处为 mock 实现，替换为真实认证）
    user, ok := authenticateUser(req.Username, req.Password)
    if !ok {
        sendError(w, http.StatusUnauthorized, "invalid_credentials", "用户名或密码错误")
        return
    }

    // 创建 JWT Claims
    claims := jwt.Claims{
        UserID:      user.ID,
        Username:    user.Username,
        Role:        user.Role,
        Permissions: user.Permissions,
        SessionID:   fmt.Sprintf("session_%d", time.Now().Unix()),
        Extra: map[string]any{
            "email": user.Email,
        },
    }

    // 签发访问令牌（短期）
    accessToken, err := processor.Create(&claims)
    if err != nil {
        sendError(w, http.StatusInternalServerError, "token_generation_failed", "令牌生成失败")
        return
    }

    // 签发刷新令牌（长期）
    refreshToken, err := processor.CreateRefresh(&claims)
    if err != nil {
        sendError(w, http.StatusInternalServerError, "token_generation_failed", "刷新令牌生成失败")
        return
    }

    // 返回令牌对给客户端
    response := LoginResponse{
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
        TokenType:    "Bearer",
        ExpiresIn:    expiresInSeconds,
        User:         user,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

// authenticateUser 验证凭据（mock 实现，替换为真实认证逻辑）
func authenticateUser(username, password string) (User, bool) {
    users := map[string]User{
        "admin": {
            ID: "1", Username: "admin", Email: "admin@example.com", Role: "admin",
            Permissions: []string{"read", "write", "delete", "admin"},
        },
        "user": {
            ID: "2", Username: "user", Email: "user@example.com", Role: "user",
            Permissions: []string{"read"},
        },
    }
    user, exists := users[username]
    if !exists || password != "password" {
        return User{}, false
    }
    return user, true
}
```

## 3. 认证中间件

从 `Authorization: Bearer <token>` 头提取令牌，调用 `Parse` 验证，并将 Claims 注入 `context.Context` 供后续处理器读取：

```go
// contextKey 是自定义类型，避免 context 键冲突
type contextKey string

const claimsKey contextKey = "claims"

// extractToken 从 Authorization 头提取 JWT
func extractToken(r *http.Request) string {
    authHeader := r.Header.Get("Authorization")
    if authHeader == "" {
        return ""
    }
    parts := strings.SplitN(authHeader, " ", 2)
    if len(parts) == 2 && parts[0] == "Bearer" {
        return parts[1]
    }
    return ""
}

// authMiddleware 验证 JWT 令牌并将 Claims 注入 context
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        token := extractToken(r)
        if token == "" {
            sendError(w, http.StatusUnauthorized, "missing_token", "需要认证令牌")
            return
        }

        claims, err := processor.Parse(token)
        if err != nil {
            sendError(w, http.StatusUnauthorized, "invalid_token", "令牌无效或已过期")
            return
        }

        // 将 Claims 注入 context，供后续处理器使用
        ctx := context.WithValue(r.Context(), claimsKey, &claims)
        next(w, r.WithContext(ctx))
    }
}

// profileHandler 返回已认证用户的资料
func profileHandler(w http.ResponseWriter, r *http.Request) {
    // 从 context 读取 Claims
    claims := r.Context().Value(claimsKey).(*jwt.Claims)

    user := User{
        ID:          claims.UserID,
        Username:    claims.Username,
        Role:        claims.Role,
        Permissions: claims.Permissions,
    }
    if email, ok := claims.Extra["email"].(string); ok {
        user.Email = email
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}
```

:::tip 自定义 contextKey
使用 `type contextKey string` 自定义类型作为 context 键，避免与其他包的键冲突——这是 Go 官方推荐的惯用法。
:::

## 4. RBAC 角色控制

基于 `claims.Role` 实现角色访问控制，可叠加在认证中间件之上：

```go
// requireRole 检查用户是否具有所需角色
func requireRole(role string, next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        claims := r.Context().Value(claimsKey).(*jwt.Claims)

        if claims.Role != role {
            sendError(w, http.StatusForbidden, "insufficient_permissions",
                fmt.Sprintf("需要 %s 角色", role))
            return
        }

        next(w, r)
    }
}

// adminHandler 处理仅管理员可访问的请求
func adminHandler(w http.ResponseWriter, r *http.Request) {
    claims := r.Context().Value(claimsKey).(*jwt.Claims)

    response := map[string]any{
        "message":     "欢迎进入管理面板",
        "admin":       claims.Username,
        "permissions": claims.Permissions,
        "timestamp":   time.Now().Format(time.RFC3339),
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}
```

## 5. 刷新端点（/refresh）

客户端在访问令牌过期后，用刷新令牌换取新的访问令牌。此端点不经过 `authMiddleware`，因为认证凭据是刷新令牌而非访问令牌：

```go
func refreshHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        sendError(w, http.StatusMethodNotAllowed, "method_not_allowed", "仅支持 POST 方法")
        return
    }

    // 从请求体获取刷新令牌
    var req struct {
        RefreshToken string `json:"refresh_token"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        sendError(w, http.StatusBadRequest, "invalid_request", "JSON 格式无效")
        return
    }

    if req.RefreshToken == "" {
        sendError(w, http.StatusBadRequest, "missing_token", "需要刷新令牌")
        return
    }

    // 用刷新令牌换取新的访问令牌
    newAccessToken, err := processor.Refresh(req.RefreshToken)
    if err != nil {
        sendError(w, http.StatusUnauthorized, "invalid_token", "刷新令牌无效或已过期")
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]any{
        "access_token": newAccessToken,
        "token_type":   "Bearer",
        "expires_in":   expiresInSeconds,
    })
}
```

## 6. 登出端点（/logout）

将当前访问令牌加入黑名单，使其立即失效。已吊销的令牌后续 `Parse` 会返回错误：

```go
func logoutHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        sendError(w, http.StatusMethodNotAllowed, "method_not_allowed", "仅支持 POST 方法")
        return
    }

    token := extractToken(r)
    if token == "" {
        sendError(w, http.StatusBadRequest, "missing_token", "未找到令牌")
        return
    }

    // 吊销令牌（加入黑名单）
    if err := processor.Revoke(token); err != nil {
        sendError(w, http.StatusInternalServerError, "logout_failed", "登出失败")
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "已成功登出",
    })
}
```

:::tip 黑名单机制
`processor.Revoke` 将令牌的 `jti` 加入内置黑名单，后续 `Parse` 调用会自动检查。黑名单配置（容量、自动清理间隔）在第 1 节初始化时设定。详见[令牌黑名单](../guides/blacklist)。
:::

## 7. 路由注册与优雅关闭

注册全部路由，使用 `signal.Notify` 捕获 `SIGINT`/`SIGTERM`，在收到中断信号后调用 `server.Shutdown` 等待活跃请求完成，再关闭 `processor` 释放黑名单等资源：

```go
// envDefault 读取环境变量，未设置时返回默认值
func envDefault(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}

func main() {
    // 初始化 processor（见第 1 节）
    var err error
    processor, expiresInSeconds, err = newJWTProcessor()
    if err != nil {
        log.Fatalf("初始化 JWT processor 失败: %v", err)
    }

    // 监听地址可通过 JWT_PORT 配置，默认 8080
    addr := ":" + envDefault("JWT_PORT", "8080")

    // 注册路由
    mux := http.NewServeMux()
    mux.HandleFunc("/login", loginHandler)
    mux.HandleFunc("/profile", authMiddleware(profileHandler))
    mux.HandleFunc("/admin", authMiddleware(requireRole("admin", adminHandler)))
    mux.HandleFunc("/logout", authMiddleware(logoutHandler))
    // /refresh 用刷新令牌认证，不走访问令牌中间件
    mux.HandleFunc("/refresh", refreshHandler)

    server := &http.Server{
        Addr:         addr,
        Handler:      mux,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    // 在 goroutine 中启动服务器
    go func() {
        log.Printf("服务器监听 http://localhost%s", addr)
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("服务器启动失败: %v", err)
        }
    }()

    // 等待中断信号以优雅关闭
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    log.Println("正在关闭服务器...")

    // 带超时的优雅关闭
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        log.Printf("服务器关闭错误: %v", err)
    }

    // 关闭 JWT processor（释放黑名单等资源）
    if err := processor.Close(); err != nil {
        log.Printf("Processor 关闭错误: %v", err)
    }

    log.Println("服务器已优雅停止")
}
```

## 路由总览

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| POST | /login | 无 | 签发令牌对 |
| GET | /profile | authMiddleware | 返回用户信息 |
| GET | /admin | authMiddleware + requireRole("admin") | 管理员页面 |
| POST | /logout | authMiddleware | 吊销令牌 |
| POST | /refresh | 无（用刷新令牌） | 换取新访问令牌 |

## 相关示例

- [基础示例](./basic) — HMAC、令牌对、吊销、限流
- [高级示例](./advanced) — RSA/ECDSA、自定义 Claims、自定义存储
- [令牌黑名单](../guides/blacklist) — 黑名单机制详解
