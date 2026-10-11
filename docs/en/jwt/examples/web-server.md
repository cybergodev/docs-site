---
sidebar_label: "Web Server Integration"
title: "Web Server Integration - CyberGo JWT | Auth & RBAC"
description: "Production JWT web server integration: Bearer auth middleware, RBAC role control, refresh token rotation, logout revocation, and graceful shutdown."
sidebar_position: 15
check_code: false
---

# Web Server Integration

This page demonstrates how to integrate CyberGo JWT into a production-grade HTTP server, covering the complete authentication lifecycle:

- **Authentication flow**: login issues access token + refresh token
- **Auth middleware**: extract and validate tokens from the `Authorization: Bearer` header
- **RBAC role control**: fine-grained access control based on `claims.Role`
- **Token refresh**: exchange refresh tokens for new access tokens
- **Logout revocation**: add tokens to the blacklist to invalidate sessions
- **Graceful shutdown**: catch interrupt signals and release resources safely

:::tip Full Source
This page is based on the bundled example `examples/web-server/main.go`, which compiles and runs directly.
:::

## 1. Initialize the Processor

In production, the secret key must come from an environment variable — **never hardcode it**. Also configure token TTLs, rate limiting, and the blacklist:

```go
package main

import (
    "log"
    "os"
    "time"

    "github.com/cybergodev/jwt"
)

// processor is the package-level JWT processor, initialized in main.
// expiresInSeconds is derived from the access-token TTL and returned to
// clients as "expires_in" so the value never drifts from the real TTL.
var (
    processor        *jwt.Processor
    expiresInSeconds int
)

func main() {
    var err error
    processor, expiresInSeconds, err = newJWTProcessor()
    if err != nil {
        log.Fatalf("Failed to initialize JWT processor: %v", err)
    }
    defer processor.Close()
    log.Println("JWT processor initialized")
}

// newJWTProcessor builds the processor from environment-driven configuration.
func newJWTProcessor() (*jwt.Processor, int, error) {
    // Secret key from environment variable (production safety, never hardcode)
    secretKey := os.Getenv("JWT_SECRET_KEY")
    if secretKey == "" {
        log.Println("WARNING: JWT_SECRET_KEY not set, using demo key")
        // The fallback key is demo-only, so the example runs standalone;
        // in production the key must come from an env var or a secrets manager
        secretKey = "Kx9#mP2$vL8@nQ5!wR7&tY3^uI6*oE4%aS1+dF0-gH9~jK2#bN5$cM8@xZ7&vB4!"
    }

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = secretKey
    cfg.AccessTokenTTL = 15 * time.Minute     // access token lifetime: 15 minutes
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour  // refresh token lifetime: 7 days
    cfg.Issuer = "web-server-example"

    // Enable rate limiting to prevent brute-force issuance
    cfg.EnableRateLimit = true
    cfg.RateLimitRate = 100 // max 100 per minute
    cfg.RateLimitWindow = time.Minute

    // Configure blacklist (for logout revocation)
    cfg.Blacklist = jwt.BlacklistConfig{
        MaxSize:           10000,
        CleanupInterval:   5 * time.Minute,
        EnableAutoCleanup: true,
    }

    p, err := jwt.New(cfg)
    if err != nil {
        return nil, 0, err
    }
    // expires_in is derived from the actual TTL to avoid drift
    return p, int(cfg.AccessTokenTTL.Seconds()), nil
}
```

:::warning Production Safety
Always inject the secret key via the `JWT_SECRET_KEY` environment variable. Never write it into source code or commit it to version control. The fallback key above exists for demo purposes only — in production, always provide the key through an environment variable or a secrets manager.
:::

## 2. Login Endpoint (/login)

After validating user credentials, issue both a short-lived access token and a long-lived refresh token, returning `access_token` + `refresh_token` + `expires_in` to the client:

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

// sendError sends a JSON error response.
func sendError(w http.ResponseWriter, status int, errorCode, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(ErrorResponse{Error: errorCode, Message: message})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        sendError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST method supported")
        return
    }

    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        sendError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON format")
        return
    }

    // Authenticate user (mock implementation — replace with real auth)
    user, ok := authenticateUser(req.Username, req.Password)
    if !ok {
        sendError(w, http.StatusUnauthorized, "invalid_credentials", "Invalid username or password")
        return
    }

    // Create JWT claims
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

    // Generate access token (short-lived)
    accessToken, err := processor.Create(&claims)
    if err != nil {
        sendError(w, http.StatusInternalServerError, "token_generation_failed", "Failed to generate token")
        return
    }

    // Generate refresh token (long-lived)
    refreshToken, err := processor.CreateRefresh(&claims)
    if err != nil {
        sendError(w, http.StatusInternalServerError, "token_generation_failed", "Failed to generate refresh token")
        return
    }

    // Return token pair to client
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

// authenticateUser validates credentials (mock implementation — replace with real auth)
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

## 3. Auth Middleware

Extract the token from the `Authorization: Bearer <token>` header, validate it with `Parse`, and inject the Claims into `context.Context` for downstream handlers to read:

```go
// contextKey is a custom type for context values to avoid collisions.
type contextKey string

const claimsKey contextKey = "claims"

// extractToken extracts JWT from the Authorization header.
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

// authMiddleware validates JWT tokens and injects Claims into context.
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        token := extractToken(r)
        if token == "" {
            sendError(w, http.StatusUnauthorized, "missing_token", "Authorization token required")
            return
        }

        claims, err := processor.Parse(token)
        if err != nil {
            sendError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired token")
            return
        }

        // Inject Claims into context for downstream handlers
        ctx := context.WithValue(r.Context(), claimsKey, &claims)
        next(w, r.WithContext(ctx))
    }
}

// profileHandler returns the authenticated user's profile.
func profileHandler(w http.ResponseWriter, r *http.Request) {
    // Read Claims from context
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

:::tip Custom contextKey
Using a custom `type contextKey string` as the context key prevents collisions with other packages — this is the idiom recommended by the Go team.
:::

## 4. RBAC Role Control

Implement role-based access control on top of `claims.Role`, stackable above the auth middleware:

```go
// requireRole checks if the user has the required role.
func requireRole(role string, next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        claims := r.Context().Value(claimsKey).(*jwt.Claims)

        if claims.Role != role {
            sendError(w, http.StatusForbidden, "insufficient_permissions",
                fmt.Sprintf("Requires %s role", role))
            return
        }

        next(w, r)
    }
}

// adminHandler handles admin-only requests.
func adminHandler(w http.ResponseWriter, r *http.Request) {
    claims := r.Context().Value(claimsKey).(*jwt.Claims)

    response := map[string]any{
        "message":     "Welcome to admin dashboard",
        "admin":       claims.Username,
        "permissions": claims.Permissions,
        "timestamp":   time.Now().Format(time.RFC3339),
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}
```

## 5. Refresh Endpoint (/refresh)

When the access token expires, the client exchanges the refresh token for a new access token. This endpoint bypasses `authMiddleware` because the credential is the refresh token, not the access token:

```go
func refreshHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        sendError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST method supported")
        return
    }

    // Get refresh token from request body
    var req struct {
        RefreshToken string `json:"refresh_token"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        sendError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON format")
        return
    }

    if req.RefreshToken == "" {
        sendError(w, http.StatusBadRequest, "missing_token", "Refresh token required")
        return
    }

    // Exchange refresh token for a new access token
    newAccessToken, err := processor.Refresh(req.RefreshToken)
    if err != nil {
        sendError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired refresh token")
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

## 6. Logout Endpoint (/logout)

Add the current access token to the blacklist so it is immediately invalidated. Subsequent `Parse` calls on a revoked token will return an error:

```go
func logoutHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        sendError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST method supported")
        return
    }

    token := extractToken(r)
    if token == "" {
        sendError(w, http.StatusBadRequest, "missing_token", "Token not found")
        return
    }

    // Revoke token (add to blacklist)
    if err := processor.Revoke(token); err != nil {
        sendError(w, http.StatusInternalServerError, "logout_failed", "Failed to logout")
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Successfully logged out",
    })
}
```

:::tip Blacklist Mechanism
`processor.Revoke` adds the token's `jti` to the built-in blacklist. Subsequent `Parse` calls check it automatically. The blacklist configuration (capacity, auto-cleanup interval) is set during initialization in Section 1. See [Token Blacklist](../guides/blacklist).
:::

## 7. Route Registration & Graceful Shutdown

Register all routes, use `signal.Notify` to catch `SIGINT`/`SIGTERM`, then call `server.Shutdown` to wait for in-flight requests to complete before closing the `processor` to release blacklist and other resources:

```go
func main() {
    // Initialize processor (see Section 1)
    var err error
    processor, expiresInSeconds, err = newJWTProcessor()
    if err != nil {
        log.Fatalf("Failed to initialize JWT processor: %v", err)
    }

    // Listen address configurable via JWT_PORT, defaults to :8080
    addr := ":8080"

    // Register routes
    mux := http.NewServeMux()
    mux.HandleFunc("/login", loginHandler)
    mux.HandleFunc("/profile", authMiddleware(profileHandler))
    mux.HandleFunc("/admin", authMiddleware(requireRole("admin", adminHandler)))
    mux.HandleFunc("/logout", authMiddleware(logoutHandler))
    // /refresh authenticates with the refresh token, not the access-token middleware
    mux.HandleFunc("/refresh", refreshHandler)

    server := &http.Server{
        Addr:         addr,
        Handler:      mux,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    // Start server in goroutine
    go func() {
        log.Printf("Server listening on http://localhost%s", addr)
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Server failed: %v", err)
        }
    }()

    // Wait for interrupt signal for graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    log.Println("Shutting down server...")

    // Graceful shutdown with timeout
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        log.Printf("Server shutdown error: %v", err)
    }

    // Close JWT processor (release blacklist and other resources)
    if err := processor.Close(); err != nil {
        log.Printf("Processor close error: %v", err)
    }

    log.Println("Server gracefully stopped")
}
```

## Route Overview

| Method | Path | Middleware | Description |
|--------|------|------------|-------------|
| POST | /login | none | Issue token pair |
| GET | /profile | authMiddleware | Return user info |
| GET | /admin | authMiddleware + requireRole("admin") | Admin page |
| POST | /logout | authMiddleware | Revoke token |
| POST | /refresh | none (uses refresh token) | Exchange for new access token |

## Related Examples

- [Basic Examples](./basic) — HMAC, token pairs, revocation, rate limiting
- [Advanced Examples](./advanced) — RSA/ECDSA, custom Claims, custom storage
- [Token Blacklist](../guides/blacklist) — Blacklist mechanism in depth
