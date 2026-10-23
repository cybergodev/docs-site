---
sidebar_label: "生产检查清单"
title: "生产检查清单 - CyberGo JSON | 上线前安全核查"
description: "CyberGo JSON 生产部署安全清单：SecurityConfig 配置、MaxNestingDepthSecurity/MaxJSONSize 资源限制、输入验证、错误处理、监控告警与性能安全平衡，附默认值与建议生产值对照表，确保生产环境可靠运行。"
sidebar_position: 30
---

# 生产检查清单

部署到生产环境前，请确认以下安全项目。

## 配置检查

### 资源限制

- [ ] 设置 `MaxNestingDepthSecurity` 防止深度嵌套攻击
- [ ] 设置 `MaxJSONSize` 限制单个值大小
- [ ] 设置 `MaxMemory` 限制总内存使用

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50
cfg.MaxJSONSize = 10 * 1024 * 1024
cfg.MaxMemory = 100 * 1024 * 1024
```

默认值与建议生产值对照（默认值即库内常量，可直接引用避免魔法数字）：

| 限制项 | Config 字段 | 库内常量 | 默认值 | 建议生产值（`SecurityConfig()` 预设） |
|--------|-------------|----------|--------|----------------------------------------|
| JSON 大小上限 | `MaxJSONSize` | `DefaultMaxJSONSize` | 100MB | 10MB |
| 嵌套深度上限 | `MaxNestingDepthSecurity` | `DefaultMaxNestingDepth` | 200 | 30 |
| 路径深度上限 | `MaxPathDepth` | `DefaultMaxPathDepth` | 50 | 30 |
| 对象键数上限 | `MaxObjectKeys` | `DefaultMaxObjectKeys` | 100000 | 5000 |
| 数组元素数上限 | `MaxArrayElements` | `DefaultMaxArrayElements` | 100000 | 5000 |
| 安全验证阈值 | `MaxSecurityValidationSize` | `DefaultMaxSecuritySize` | 10MB | 10MB |
| 并发上限 | `MaxConcurrency` | `DefaultMaxConcurrency` | 50 | 50 |

```go
// 引用常量而非硬编码
cfg := json.DefaultConfig()
cfg.MaxJSONSize = int64(json.DefaultMaxJSONSize) / 10 // 在默认 100MB 基础上收紧
```

`json.SecurityConfig()` 已按上表「建议生产值」预设全部字段，并额外开启 `FullSecurityScan`（同时把已废弃、不被读取的 `StrictMode`/`EnableValidation` 置为 `true`，二者无实际影响）——面向不可信输入时优先从它出发再微调。

## 输入验证

### 必填字段

- [ ] 验证所有必填字段存在
- [ ] 验证字段类型正确

```go
// 自定义必填字段检查：注册 ValidationHook（Validator 接口已废弃、从不执行）
cfg := json.DefaultConfig()
cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    // 检查必填字段是否存在（结构化检查也可用 ValidateSchema）
    return nil
}))
```

### 格式验证

- [ ] 验证邮箱格式
- [ ] 验证 URL 格式
- [ ] 验证自定义格式

```go
// 自定义格式检查：注册 ValidationHook（Validator 接口已废弃、从不执行）
cfg := json.DefaultConfig()
cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return nil
    }
    email, _ := data["email"].(string)
    matched, _ := regexp.MatchString(`^\w+@\w+\.\w+$`, email)
    if !matched {
        return errors.New("invalid email format")
    }
    return nil
}))
```

### 范围验证

- [ ] 验证数值范围
- [ ] 验证字符串长度
- [ ] 验证数组长度

```go
// 使用 Schema 进行范围验证
schema := &json.Schema{
    Type: "object",
    Properties: map[string]*json.Schema{
        "age":  {Type: "number", Minimum: 0, Maximum: 100},
        "name": {Type: "string", MinLength: 1, MaxLength: 255},
    },
}
```

## 敏感数据处理

### 过滤敏感字段

- [ ] 过滤密码字段
- [ ] 过滤令牌字段
- [ ] 过滤其他敏感数据

```go
// 使用 Hook 过滤敏感字段
type SensitiveFilterHook struct {
    fields map[string]bool
}

func (h *SensitiveFilterHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *SensitiveFilterHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&SensitiveFilterHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "api_key":  true,
    "secret":   true,
}})
```

完整落地代码（`Get` 返回前自动剥离敏感字段）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

// SensitiveFilterHook 在 get 结果返回调用方之前删除敏感字段。
type SensitiveFilterHook struct {
	fields map[string]bool
}

func (h *SensitiveFilterHook) Before(ctx json.HookContext) error {
	return nil
}

func (h *SensitiveFilterHook) After(ctx json.HookContext, result any, err error) (any, error) {
	if err != nil {
		return result, err
	}
	if obj, ok := result.(map[string]any); ok {
		for field := range h.fields {
			delete(obj, field)
		}
	}
	return result, err
}

func main() {
	cfg := json.DefaultConfig()
	cfg.AddHook(&SensitiveFilterHook{fields: map[string]bool{
		"password": true,
		"token":    true,
		"api_key":  true,
		"secret":   true,
	}})

	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	user, err := p.Get(`{"name": "Alice", "role": "admin", "password": "hunter2", "token": "t-123"}`, ".")
	if err != nil {
		panic(err)
	}

	out, err := p.Marshal(user)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	// 输出：{"name":"Alice","role":"admin"}
}
```

### 日志脱敏

- [ ] 日志中不记录敏感数据
- [ ] 错误消息不包含敏感信息

## 错误处理

### 安全的错误响应

- [ ] 不暴露内部错误细节
- [ ] 使用通用错误消息
- [ ] 记录详细错误到日志

```go
if err != nil {
    slog.Error("详细错误", "error", err) // 详细原因只进日志
    return errors.New("操作失败，请稍后重试") // 对外只返回通用消息
}
```

## 监控与审计

### 性能监控

- [ ] 监控解析时间
- [ ] 监控内存使用
- [ ] 设置告警阈值

```go
// 使用 Hook 监控性能
type MetricsHook struct{}

func (h *MetricsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *MetricsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    slog.Info("operation", "op", ctx.Operation, "duration", time.Since(ctx.StartTime))
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&MetricsHook{})
```

计时场景直接用工厂钩子更省事：`cfg.AddHook(json.TimingHook(myRecorder))`（`myRecorder` 实现 `Record(op string, duration time.Duration)`）。

### 审计日志

- [ ] 记录关键操作
- [ ] 记录异常输入
- [ ] 定期审查日志

完整落地代码（审计写操作 + 操作计时，全部走工厂钩子与 `HookFunc`，不落任何原始 `JSONStr`）：

```go
package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/cybergodev/json"
)

// opMetrics 实现 TimingHook 要求的 Record 接口
type opMetrics struct {
	mu    sync.Mutex
	count map[string]int
}

func (m *opMetrics) Record(op string, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.count[op]++
}

func main() {
	metrics := &opMetrics{count: make(map[string]int)}
	var auditLog []string

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 审计：只记录写操作的操作类型/路径/结果，不记录 JSONStr 内容
	p.AddHook(&json.HookFunc{
		AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
			if ctx.Operation == "set" || ctx.Operation == "delete" {
				auditLog = append(auditLog,
					fmt.Sprintf("op=%s path=%s ok=%v", ctx.Operation, ctx.Path, err == nil))
			}
			return result, err
		},
	})
	// 性能：按操作类型计数（生产替换为直方图/时序库）
	p.AddHook(json.TimingHook(metrics))

	data := `{"env": "prod", "password": "hunter2"}`

	if data, err = p.Set(data, "password", nil); err != nil {
		panic(err)
	}
	if data, err = p.Delete(data, "password"); err != nil {
		panic(err)
	}
	if _, err = p.Get(data, "env"); err != nil {
		panic(err)
	}

	for _, e := range auditLog {
		fmt.Println(e)
	}
	fmt.Println("get 计时记录：", metrics.count["get"])
	// 输出：
	// op=set path=password ok=true
	// op=delete path=password ok=true
	// get 计时记录：1
}
```

## 测试覆盖

### 安全测试

- [ ] 深度嵌套测试
- [ ] 大文件处理测试
- [ ] 无效输入测试
- [ ] 边界条件测试

### 性能测试

- [ ] 并发处理测试
- [ ] 大数据量测试
- [ ] 内存泄漏测试

## 快速检查命令

```bash
# 检查敏感字段
grep -r "password\|token\|secret" --include="*.go"

# 检查硬编码配置
grep -r "MaxNestingDepthSecurity\|MaxMemory" --include="*.go"

# 运行安全测试
go test -run Security ./...
```

## 检查清单模板

```go
// 生产配置模板
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()

    // 资源限制（SecurityConfig 已预设安全默认值）
    cfg.MaxMemory = 100 * 1024 * 1024

    // 自定义输入检查（ValidationHook；Validator 接口已废弃、从不执行）
    cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
        return nil // 自定义必填/格式检查
    }))

    // 审计 Hook
    cfg.Hooks = []json.Hook{&AuditHook{logger: prodLogger}}

    return cfg
}
```

## 相关

- [安全概述](./)
- [Config 配置](../api-reference/config)
