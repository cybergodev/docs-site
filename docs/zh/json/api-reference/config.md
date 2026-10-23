---
sidebar_label: "Config"
title: "Config 配置 - CyberGo JSON | 配置项与预设方法"
description: "CyberGo JSON Config 配置详解：缓存、并发、大小与安全限制、处理选项、编码选项、JSONL 流式参数与 MergeMode 合并策略一应俱全，提供 DefaultConfig/SecurityConfig/PrettyConfig 三种预设及 Clone/Validate/AddHook 等方法，帮助开发者精准定制并校验 Processor 行为。"
sidebar_position: 40
---

# Config

Config 用于自定义 Processor 和所有 JSON 操作的行为。

## Config 结构体

```go
type Config struct {
    // ===== 缓存设置 =====
    MaxCacheSize int           `json:"max_cache_size"` // 最大缓存条目数
    CacheTTL     time.Duration `json:"cache_ttl"`      // 缓存过期时间
    EnableCache  bool          `json:"enable_cache"`   // 是否启用缓存
    CacheResults bool          `json:"cache_results"`  // 是否缓存操作结果
    CacheSharedResults bool `json:"cache_shared_results"` // 共享缓存结果（跳过防御性深拷贝，调用方不得修改返回的容器）

    // ===== 大小限制 =====
    MaxJSONSize  int64 `json:"max_json_size"`  // 最大 JSON 大小（字节）
    MaxPathDepth int   `json:"max_path_depth"` // 最大路径深度
    MaxBatchSize int   `json:"max_batch_size"` // 最大批量操作数

    // ===== 安全限制 =====
    MaxNestingDepthSecurity   int   `json:"max_nesting_depth"`           // 最大嵌套深度
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"` // 安全验证最大大小
    MaxObjectKeys             int   `json:"max_object_keys"`             // 对象最大键数
    MaxArrayElements          int   `json:"max_array_elements"`          // 数组最大元素数
    FullSecurityScan          bool  `json:"full_security_scan"`          // 启用完整安全扫描

    // ===== 并发 =====
    MaxConcurrency    int `json:"max_concurrency"`    // 最大并发数
    ParallelThreshold int `json:"parallel_threshold"` // 并行处理阈值
    MaxOperationsPerSecond int `json:"max_operations_per_second"` // 受控操作速率上限（0 = 不限）

    // ===== 处理选项 =====
    EnableValidation bool `json:"enable_validation"` // 启用验证（已废弃，不被读取）
    StrictMode       bool `json:"strict_mode"`       // 严格模式（已废弃，不被读取）
    CreatePaths      bool `json:"create_paths"`      // 自动创建路径
    CleanupNulls     bool `json:"cleanup_nulls"`     // 清理 null 值
    CompactArrays    bool `json:"compact_arrays"`    // 压缩数组
    ContinueOnError  bool `json:"continue_on_error"` // 批量操作出错时继续

    // ===== 输入/输出选项 =====
    AllowComments    bool `json:"allow_comments"`     // 允许注释（已废弃，不被读取）
    PreserveNumbers  bool `json:"preserve_numbers"`   // 保留数字精度
    ValidateInput    bool `json:"validate_input"`     // 验证输入（已废弃，不被读取）
    ValidateFilePath bool `json:"validate_file_path"` // 验证文件路径
    SkipValidation   bool `json:"skip_validation"`    // 跳过验证（受信任输入）
    DetectDuplicateKeys bool `json:"detect_duplicate_keys"` // 检测并拒绝对象中的重复键

    // ===== 编码选项 =====
    Pretty          bool            `json:"pretty"`           // 格式化输出
    Indent          string          `json:"indent"`           // 缩进字符串
    Prefix          string          `json:"prefix"`           // 前缀
    EscapeHTML      bool            `json:"escape_html"`      // HTML 转义
    SortKeys        bool            `json:"sort_keys"`        // 键排序
    ValidateUTF8    bool            `json:"validate_utf8"`    // UTF-8 验证
    MaxDepth        int             `json:"max_depth"`        // 最大编码深度
    DisallowUnknown bool            `json:"disallow_unknown"` // 禁止未知字段
    FloatPrecision  int             `json:"float_precision"`  // 浮点精度（-1 为自动）
    FloatTruncate   bool            `json:"float_truncate"`   // 截断浮点数
    DisableEscaping bool            `json:"disable_escaping"` // 禁用转义
    EscapeUnicode   bool            `json:"escape_unicode"`   // Unicode 转义
    EscapeSlash     bool            `json:"escape_slash"`     // 斜杠转义
    EscapeNewlines  bool            `json:"escape_newlines"`  // 换行符转义
    EscapeTabs      bool            `json:"escape_tabs"`      // 制表符转义
    IncludeNulls    bool            `json:"include_nulls"`    // 包含 null 值
    CustomEscapes   map[rune]string `json:"custom_escapes,omitempty"` // 自定义转义映射

    // ===== 可观测性 =====
    EnableMetrics     bool `json:"enable_metrics"`      // 启用指标收集
    EnableHealthCheck bool `json:"enable_health_check"` // 启用健康检查（已废弃，不被读取）

    // ===== 大文件处理 =====
    ChunkSize       int64 `json:"chunk_size"`       // 分块大小（已废弃，不被读取）
    MaxMemory       int64 `json:"max_memory"`       // 最大内存使用
    BufferSize      int   `json:"buffer_size"`      // 缓冲区大小
    SaveFileMode    os.FileMode `json:"save_file_mode,omitempty"` // 新建文件的权限位（0 回退 0644）
    SamplingEnabled bool  `json:"sampling_enabled"` // 启用采样（已废弃，不被读取）
    SampleSize      int   `json:"sample_size"`      // 采样数量（已废弃，不被读取）

    // ===== JSONL 配置 =====
    JSONLBufferSize    int   `json:"jsonl_buffer_size"`     // JSONL 缓冲区大小
    JSONLMaxLineSize   int   `json:"jsonl_max_line_size"`   // JSONL 最大行大小
    JSONLSkipEmpty     bool  `json:"jsonl_skip_empty"`      // 跳过空行
    JSONLSkipComments  bool  `json:"jsonl_skip_comments"`   // 跳过注释行
    JSONLContinueOnErr bool  `json:"jsonl_continue_on_err"` // 出错时继续
    JSONLWorkers       int   `json:"jsonl_workers"`         // JSONL 并行工作数
    JSONLChunkSize     int   `json:"jsonl_chunk_size"`      // JSONL 分块大小
    JSONLMaxMemory     int64 `json:"jsonl_max_memory"`      // JSONL 最大内存

    // ===== 合并选项 =====
    MergeMode MergeMode `json:"merge_mode"` // 合并策略

    // ===== 文件访问安全 =====
    AllowedFileDirs []string `json:"allowed_file_dirs,omitempty"` // 文件操作目录白名单（空 = 仅内置拦截）

    // ===== 扩展点（无 JSON tag，不参与序列化） =====
    CustomEncoder               CustomEncoder                // 自定义编码器（已废弃，未挂接）
    CustomTypeEncoders          map[reflect.Type]TypeEncoder // 自定义类型编码器（已废弃，未挂接）
    CustomValidators            []Validator                  // 自定义验证器（已废弃，不会执行）
    AdditionalDangerousPatterns []DangerousPattern           // 额外危险模式
    DisableDefaultPatterns      bool                         // 禁用默认警告级模式
    Hooks                       []Hook                       // 操作钩子
    CustomPathParser            PathParser                   // 自定义路径解析器
}
```

::: warning CacheSharedResults 契约
`CacheSharedResults` 为 `true` 时，缓存命中的 `Get`/`GetFromParsed` 会**直接返回缓存值**，跳过防御性深拷贝（更快、更少分配）。此时**调用方不得修改**返回的 `map[string]any`/`[]any`，否则会破坏共享缓存、影响后续读取；原始值（`bool`、`float64`、`string`、`json.Number`、`nil`）不可变，始终安全。默认 `false` 保留安全的”读时拷贝”行为，仅在调用方将结果视为只读时启用（例如反复读取同一大型子树的只读工作负载）。
:::

::: warning 扩展字段挂接状态
`CustomEncoder`、`CustomTypeEncoders`、`CustomValidators` 三个接口字段**已废弃**（源码标注 Deprecated）：已声明并参与配置克隆与缓存键计算，但编码器/验证器**从未在编码/操作流水线中执行**，设置后不会产生效果；内置编码器不可替换。三者均在 v1 生命周期内保留。`CustomPathParser` **已挂接**：设置后所有路径类操作都会调用自定义解析器替代内置解析器（见[接口定义](./interfaces#pathparser)）。当前可用的扩展方式：

- 编码行为定制 → `CustomEscapes`（**已生效**，见下方编码选项）或实现 `json.Marshaler`/`encoding.TextMarshaler`（见[自定义编码器](../extensions/custom-encoder)）
- 操作拦截 → `Hooks` + `AddHook`（**已生效**，见 [Hook 钩子系统](../extensions/hooks)）
- 自定义路径语法 → `CustomPathParser`（**已生效**，见[接口定义](./interfaces#pathparser)）
- 输入验证 → `ValidateSchema`（见[Schema 校验](./schema)）
:::

## Config 字段总表

以下按功能分组列出 `Config` 的全部导出字段。默认值取自 [`DefaultConfig()`](#defaultconfig)，字段有效范围与自动修正规则见[钳制范围速查](#validatewithwarnings)。

### 缓存

| 字段                   | 类型            | 默认值 | 说明                                                                                     |
| ---------------------- | --------------- | ------ | ---------------------------------------------------------------------------------------- |
| `MaxCacheSize`         | `int`           | 128    | 最大缓存条目数（0 表示禁用缓存）                                                         |
| `CacheTTL`             | `time.Duration` | 5 分钟 | 缓存条目存活时间                                                                         |
| `EnableCache`          | `bool`          | true   | 是否启用缓存                                                                             |
| `CacheResults`         | `bool`          | true   | 是否缓存操作结果（按操作缓存）                                                           |
| `CacheSharedResults`   | `bool`          | false  | 缓存命中直接返回共享值，跳过防御性深拷贝；调用方不得修改返回的容器（契约见上方警告）     |

### 大小限制

| 字段          | 类型    | 默认值 | 说明                                       |
| ------------- | ------- | ------ | ------------------------------------------ |
| `MaxJSONSize` | `int64` | 100MB  | 最大 JSON 输入大小（字节）                 |
| `MaxPathDepth` | `int`  | 50     | 最大路径深度                               |
| `MaxBatchSize` | `int`  | 2000   | 单次批量操作数上限（超出即拒绝，防内存耗尽） |

### 安全限制

| 字段                       | 类型    | 默认值  | 说明                                                                                                              |
| -------------------------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `MaxNestingDepthSecurity`  | `int`   | 200     | 最大嵌套深度                                                                                                      |
| `MaxSecurityValidationSize` | `int64` | 10MB    | 安全验证最大大小（超过后按采样策略扫描，除非 `FullSecurityScan` 为 true）                                          |
| `MaxObjectKeys`            | `int`   | 100000  | 单个对象最大键数                                                                                                  |
| `MaxArrayElements`         | `int`   | 100000  | 单个数组最大元素数                                                                                                |
| `FullSecurityScan`         | `bool`  | false   | true 时对所有输入全量（非采样）安全扫描；false 时大输入（>4KB）采用滚动窗口 + 采样扫描，关键模式（`__proto__` 等）仍全量扫描 |

### 并发

| 字段                | 类型  | 默认值 | 说明                                     |
| ------------------- | ----- | ------ | ---------------------------------------- |
| `MaxConcurrency`    | `int` | 50     | 最大并发数                               |
| `ParallelThreshold` | `int` | 10     | 并行处理阈值（低于该元素数退化为顺序处理） |
| `MaxOperationsPerSecond` | `int` | 0（不限速） | 受控操作（Get/Set/Delete 等）的速率上限：距上一次操作不足 `1/MaxOperationsPerSecond` 秒的新操作被拒绝并返回限速错误。`Validate` 钳制到 [0, 1000000] |

### 处理选项

| 字段               | 类型   | 默认值 | 说明                           |
| ------------------ | ------ | ------ | ------------------------------ |
| `EnableValidation` | `bool` | true   | 已废弃：不被任何操作读取（校验默认始终执行，除非 `SkipValidation`），仅参与配置缓存键 |
| `StrictMode`       | `bool` | false  | 已废弃：不被任何解析器/操作读取，设置后不改变行为，仅参与配置缓存键 |
| `CreatePaths`      | `bool` | true   | Set 时自动创建缺失的中间路径   |
| `CleanupNulls`     | `bool` | false  | 清理 null 值                   |
| `CompactArrays`    | `bool` | false  | 压缩数组                       |
| `ContinueOnError`  | `bool` | false  | 批量操作单项出错时继续执行     |

### 输入/输出选项

| 字段                | 类型   | 默认值 | 说明                                                     |
| ------------------- | ------ | ------ | -------------------------------------------------------- |
| `AllowComments`     | `bool` | false  | 已废弃：不被任何解析器读取（JSONL 注释行由 `JSONLSkipComments` 单独控制），仅参与配置缓存键 |
| `PreserveNumbers`   | `bool` | false  | 解码保留数字字面量（`1.10` 不会变成 `1.1`），编码原样回写 |
| `ValidateInput`     | `bool` | true   | 已废弃：不被任何操作读取，设置后不改变行为，仅参与配置缓存键 |
| `ValidateFilePath`  | `bool` | true   | 验证文件路径                                             |
| `SkipValidation`    | `bool` | false  | 跳过非必要校验（仅用于可信输入）                         |
| `DetectDuplicateKeys` | `bool` | false  | 拒绝任何对象含重复键的输入，返回包装 `ErrDuplicateKey` 的错误。默认 `false` 与 `encoding/json` 一致（重复键后者胜出）；显式开启后即使 `SkipValidation` 也生效。键按原始字节比较（转义写法不同视为不同键） |

### 编码选项

| 字段              | 类型              | 默认值           | 说明                                                     |
| ----------------- | ----------------- | ---------------- | -------------------------------------------------------- |
| `Pretty`          | `bool`            | false            | 格式化输出                                               |
| `Indent`          | `string`          | "  "（两个空格） | 缩进字符串                                               |
| `Prefix`          | `string`          | ""（空）         | 每行前缀                                                 |
| `EscapeHTML`      | `bool`            | true             | HTML 字符转义（`<` `>` `&`）                              |
| `SortKeys`        | `bool`            | false            | 对象键排序输出                                           |
| `ValidateUTF8`    | `bool`            | true             | UTF-8 验证（预留字段，当前不改变行为）                   |
| `MaxDepth`        | `int`             | 100              | 编码最大深度（0 表示不限）                               |
| `DisallowUnknown` | `bool`            | false            | 解码时禁止未知字段（等价 `Decoder.DisallowUnknownFields()`） |
| `FloatPrecision`  | `int`             | -1               | 浮点精度（-1 自动；0–15 显式精度）                       |
| `FloatTruncate`   | `bool`            | false            | 精度生效时直接截断而非四舍五入                           |
| `DisableEscaping` | `bool`            | false            | 禁用转义逻辑（仅在完全受控输出时使用）                   |
| `EscapeUnicode`   | `bool`            | false            | 非 ASCII 字符转 `\uXXXX`                                  |
| `EscapeSlash`     | `bool`            | false            | `/` 转义为 `\/`                                           |
| `EscapeNewlines`  | `bool`            | true             | 换行符转义                                               |
| `EscapeTabs`      | `bool`            | true             | 制表符转义                                               |
| `IncludeNulls`    | `bool`            | true             | 编码时包含值为 null 的字段                               |
| `CustomEscapes`   | `map[rune]string` | nil              | 自定义字符转义映射                                       |

### 可观测性

| 字段                | 类型   | 默认值 | 说明                                                         |
| ------------------- | ------ | ------ | ------------------------------------------------------------ |
| `EnableMetrics`     | `bool` | false  | 启用指标收集（`GetStats` / `GetHealthStatus` 才有数据）      |
| `EnableHealthCheck` | `bool` | false  | 已废弃：不被读取（`GetHealthStatus`/`GetStats` 不受此开关控制，是否有数据取决于 `EnableMetrics`），仅参与配置缓存键 |

### 大文件处理（采样与流式）

| 字段              | 类型    | 默认值 | 说明                     |
| ----------------- | ------- | ------ | ------------------------ |
| `ChunkSize`       | `int64` | 1MB    | 已废弃：不被任何代码路径读取（流式读取用 `BufferSize`），仅参与配置缓存键 |
| `MaxMemory`       | `int64` | 100MB  | 大文件处理最大内存       |
| `BufferSize`      | `int`   | 64KB   | 大文件读取缓冲区大小     |
| `SaveFileMode`    | `os.FileMode` | 0（回退 0644） | `SaveToFile` / `MarshalToFile` **新建文件**的权限位；已有文件保持原权限（与 `os.WriteFile` 一致）。敏感数据建议 `0600`；`Validate` 将其掩码为 ≤ 0777 的权限位 |
| `SamplingEnabled` | `bool`  | true   | 已废弃：不被读取（安全扫描是否采样由 `FullSecurityScan` 与 `MaxSecurityValidationSize` 决定），仅参与配置缓存键 |
| `SampleSize`      | `int`   | 1000   | 已废弃：不被任何代码路径读取，仅参与配置缓存键 |

### JSONL 配置

| 字段                  | 类型    | 默认值 | 说明                             |
| --------------------- | ------- | ------ | -------------------------------- |
| `JSONLBufferSize`     | `int`   | 64KB   | JSONL 读取缓冲区大小             |
| `JSONLMaxLineSize`    | `int`   | 1MB    | JSONL 单行最大大小               |
| `JSONLSkipEmpty`      | `bool`  | true   | 跳过空行                         |
| `JSONLSkipComments`   | `bool`  | false  | 跳过 `#` / `//` 注释行            |
| `JSONLContinueOnErr`  | `bool`  | false  | 解析出错时继续处理后续行         |
| `JSONLWorkers`        | `int`   | 4      | JSONL 并行 worker 数             |
| `JSONLChunkSize`      | `int`   | 1000   | 批处理分块大小（行数）           |
| `JSONLMaxMemory`      | `int64` | 100MB  | JSONL 处理最大内存               |

### 合并选项

| 字段        | 类型       | 默认值     | 说明                                                       |
| ----------- | ---------- | ---------- | ---------------------------------------------------------- |
| `MergeMode` | `MergeMode` | MergeUnion | `MergeJSON` / `MergeMany` 的合并策略（见[合并模式](#合并模式)） |

### 文件访问安全

| 字段              | 类型       | 默认值 | 说明 |
| ----------------- | ---------- | ------ | ---- |
| `AllowedFileDirs` | `[]string` | 空     | 路径类文件 API 的**目录白名单**：非空时，传给 `LoadFromFile`、`UnmarshalFromFile`、`SaveToFile`、`MarshalToFile`、`ForeachFile*` 家族与 `StreamJSONLFile` 的每个路径（经 symlink 解析后）必须位于其中一个目录内，否则返回 `ErrSecurityViolation`。该白名单在内置平台拦截名单**之外**额外生效。条目须为绝对路径（`Validate` 会把相对路径解析为绝对路径并给出警告，空条目被丢弃）；匹配按清理后路径的前缀进行。per-call cfg 中非空的列表覆盖处理器自身列表；已废弃的 `NDJSONProcessor` 入口不感知该白名单 |

```go
cfg := json.DefaultConfig()
// 仅允许访问 /var/lib/myapp/data 下的文件
cfg.AllowedFileDirs = []string{"/var/lib/myapp/data"}
```

### 扩展点

以下字段无 JSON tag、不参与序列化；挂接状态见上方警告。

| 字段                          | 类型                               | 默认值 | 说明                                             |
| ----------------------------- | ---------------------------------- | ------ | ------------------------------------------------ |
| `CustomEncoder`               | `CustomEncoder`                    | nil    | 自定义编码器（已废弃：未挂接，设置后无效；用 `json.Marshaler` 替代） |
| `CustomTypeEncoders`          | `map[reflect.Type]TypeEncoder`     | nil    | 按 Go 类型注册的编码器（已废弃：未挂接，设置后无效） |
| `CustomValidators`            | `[]Validator`                      | nil    | 操作前运行的自定义验证器（已废弃：从不执行；用 `AddHook` + Before 钩子替代） |
| `AdditionalDangerousPatterns` | `[]DangerousPattern`               | nil    | 在内置模式之外追加的危险模式                     |
| `DisableDefaultPatterns`      | `bool`                             | false  | 禁用内置警告级模式（关键模式始终强制，不可禁用） |
| `Hooks`                       | `[]Hook`                           | nil    | 操作前后钩子（已生效）                           |
| `CustomPathParser`            | `PathParser`                       | nil    | 自定义路径解析器（已生效，替代内置路径解析器）   |

## 编码选项详解

编码选项（`Pretty`/`Indent`/`EscapeHTML`/`SortKeys`/`FloatPrecision` 等）控制 `Marshal`/`Encode` 系列的输出形态。默认值与标准库对齐（如 `EscapeHTML: true`、`IncludeNulls: true`）；当设置了任一「非默认」编码选项时，库内部自动切换到自定义编码器路径以满足需求，无需手动干预。

### 键排序（SortKeys）

```go
cfg := json.DefaultConfig()
cfg.SortKeys = true
s, _ := json.Encode(map[string]any{"b": 2, "a": 1}, cfg)
// 输出：{"a":1,"b":2} — 输出键序稳定，便于比对与测试
```

### 浮点精度（FloatPrecision / FloatTruncate）

```go
cfg := json.DefaultConfig()
cfg.FloatPrecision = 2 // -1（默认）= 自动精度
s, _ := json.Encode(3.14159265, cfg)
// 输出：3.14
```

`FloatTruncate` 控制 `FloatPrecision` 生效时的舍入方式：默认（`false`）按标准四舍五入；置 `true` 后改为**直接截断**——`3.999` 在精度 2 下输出 `3.99`（舍入则会得到 `4.00`）。仅在 `FloatPrecision >= 0` 时参与编码。

### 自定义字符转义（CustomEscapes）

```go
cfg := json.DefaultConfig()
cfg.CustomEscapes = map[rune]string{
    '<': "&lt;",
}
s, _ := json.Encode("<a>", cfg)
// 输出："&lt;a>"
```

### 常用开关速查

| 选项 | 默认 | 置反/置真后的效果 |
|------|------|-------------------|
| `EscapeHTML` | `true` | `false` 后 `<` `>` `&` 不转义 |
| `EscapeUnicode` | `false` | `true` 后非 ASCII 字符转 `\uXXXX` |
| `EscapeSlash` | `false` | `true` 后 `/` 转义为 `\/` |
| `EscapeNewlines` / `EscapeTabs` | `true` | `false` 后控制字符直出（生成 JSONL 友好文本时慎用） |
| `DisableEscaping` | `false` | `true` 后跳过转义逻辑（仅在完全受控输出时使用） |
| `IncludeNulls` | `true` | `false` 后编码时省略值为 `null` 的字段 |
| `PreserveNumbers` | `false` | `true` 后解码保留数字字面量（`1.10` 不会变成 `1.1`），编码时原样回写 |

## 输入与可观测性开关

以下字段控制解码严格度与运行时观测（默认值见 [`DefaultConfig`](#defaultconfig)）：

| 字段 | 默认 | 生效范围 | 说明 |
|------|------|----------|------|
| `DisallowUnknown` | `false` | `NewDecoder(r, cfg)` | `true` 时等价于对返回的 Decoder 调用 `DisallowUnknownFields()`，解码遇到未知字段报错 |
| `ValidateUTF8` | `true` | 预留 | 当前不改变行为（见下方说明） |
| `AllowComments` | `false` | 已废弃 | 不被任何解析器读取（见下方说明） |
| `EnableMetrics` | `false` | `New(cfg)` 构造时 | `true` 时创建指标采集器，`GetStats` 的操作/错误计数与 `GetHealthStatus` 的分项检查才有数据 |
| `EnableHealthCheck` | `false` | 已废弃 | 不被读取（见下方说明） |
| `SamplingEnabled` | `true` | 已废弃 | 不被读取（见下方说明） |

::: warning 预留/已废弃字段说明
以下字段已声明并参与配置比较与哈希（因此会区分不同 cfg 对应的处理器缓存），但**未被对应流水线读取**，设置后不改变行为（除 `ValidateUTF8` 为预留字段外，其余在源码中均已标注 Deprecated；全部在 v1 生命周期内保留）：

- `EnableValidation`：校验默认始终执行，除非 `SkipValidation` 为 `true`——本开关不被任何操作读取。
- `StrictMode`：不被任何解析器或操作读取。
- `AllowComments`：不会让解析接受 `//` 或 `#` 注释；JSONL 文件的注释行由 `JSONLSkipComments` 单独控制。
- `ValidateInput`：不被任何操作读取。
- `EnableHealthCheck`：健康检查通过 `GetHealthStatus` 随取随查，是否有数据取决于 `EnableMetrics`（见[生命周期与统计](./processor/lifecycle#健康检查)）。
- `ChunkSize`：不被任何代码路径读取，流式读取实际使用 `BufferSize`。
- `SamplingEnabled` / `SampleSize`：大输入的安全扫描是否采样由 `FullSecurityScan` 与 `MaxSecurityValidationSize` 决定，与这两个字段无关。
- `ValidateUTF8`：输入侧对无效 UTF-8 的拒绝是安全校验的无条件行为，输出侧按标准库语义处理，均不受此开关影响。
:::

## 配置预设

### DefaultConfig

签名：`func DefaultConfig() Config`

返回默认配置，适合大多数场景。

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**默认值**

| 字段 | 值 | 说明 |
|------|-----|------|
| MaxJSONSize | 100MB | JSON 大小限制 |
| MaxNestingDepthSecurity | 200 | 嵌套深度 |
| MaxPathDepth | 50 | 路径深度 |
| MaxSecurityValidationSize | 10MB | 安全验证大小上限 |
| MaxObjectKeys | 100000 | 对象最大键数 |
| MaxArrayElements | 100000 | 数组最大元素数 |
| MaxConcurrency | 50 | 并发数 |
| ParallelThreshold | 10 | 低于该元素数时退化为顺序处理 |
| MaxOperationsPerSecond | 0 | 受控操作速率上限（0 = 不限速） |
| MaxBatchSize | 2000 | 批量操作数 |
| CacheTTL | 5 分钟 | 缓存过期 |
| MaxCacheSize | 128 | 最大缓存条目数 |
| EnableCache | true | 启用缓存 |
| CacheResults | true | 缓存操作结果 |
| CacheSharedResults | false | 共享缓存结果（高性能只读场景） |
| EnableValidation | true | 启用验证（已废弃，不被读取） |
| StrictMode | false | 非严格模式（已废弃，不被读取） |
| FullSecurityScan | false | 采样安全扫描（非全量） |
| ValidateInput | true | 验证输入（已废弃，不被读取） |
| ValidateFilePath | true | 验证文件路径 |
| DetectDuplicateKeys | false | 不检测重复键（重复键后者胜出） |
| CreatePaths | true | 自动创建路径 |
| Pretty | false | 不格式化输出 |
| EscapeHTML | true | HTML 转义 |
| ValidateUTF8 | true | UTF-8 验证 |
| IncludeNulls | true | 包含 null |
| EscapeNewlines | true | 换行符转义 |
| EscapeTabs | true | 制表符转义 |
| FloatPrecision | -1 | 自动精度 |
| MaxDepth | 100 | 编码深度 |
| Indent | "  " | 默认缩进 |
| ChunkSize | 1MB | 分块大小（已废弃，不被读取） |
| MaxMemory | 100MB | 最大内存 |
| BufferSize | 64KB | 缓冲区大小 |
| SaveFileMode | 0 | 新建文件权限位（0 回退 0644） |
| SamplingEnabled | true | 启用采样（已废弃，不被读取） |
| SampleSize | 1000 | 采样数量（已废弃，不被读取） |
| JSONLBufferSize | 64KB | JSONL 缓冲区大小 |
| JSONLMaxLineSize | 1MB | JSONL 最大行大小 |
| JSONLSkipEmpty | true | 跳过空行 |
| JSONLSkipComments | false | 不跳过注释 |
| JSONLContinueOnErr | false | 出错时停止 |
| JSONLWorkers | 4 | 并行工作数 |
| JSONLChunkSize | 1000 | JSONL 分块大小 |
| JSONLMaxMemory | 100MB | JSONL 最大内存 |
| MergeMode | MergeUnion | 联合合并 |

### SecurityConfig

签名：`func SecurityConfig() Config`

返回安全配置，适用于处理不可信输入。

```go
// 推荐用于：
// - 公共 API 和 Web 服务
// - 用户提交的数据
// - 外部 Webhook
// - 认证端点
// - 金融数据处理
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**安全配置特点**

| 字段 | 值 | 说明 |
|------|-----|------|
| MaxNestingDepthSecurity | 30 | 保守嵌套深度 |
| MaxSecurityValidationSize | 10MB | 安全验证大小 |
| MaxObjectKeys | 5000 | 保守键数限制 |
| MaxArrayElements | 5000 | 保守元素限制 |
| MaxJSONSize | 10MB | 保守大小限制 |
| MaxPathDepth | 30 | 保守路径深度 |
| FullSecurityScan | true | 完整安全扫描 |
| StrictMode | true | 严格模式（已废弃字段：`SecurityConfig` 会置 `true`，但不被任何解析器读取，无实际影响） |
| EnableValidation | true | 启用验证（已废弃字段：`SecurityConfig` 会置 `true`，但不被任何操作读取，无实际影响） |
| EnableCache | true | 启用缓存 |
| MaxCacheSize | 256 | 缓存大小 |
| CacheTTL | 3 分钟 | 较短 TTL |

### PrettyConfig

签名：`func PrettyConfig() Config`

返回格式化输出配置。

```go
result, err := json.Encode(data, json.PrettyConfig())
```

## 配置方法

### Clone

签名：`func (c *Config) Clone() *Config`

深拷贝配置（`Config.Clone` 返回新 `*Config`，修改副本不影响原配置）。值字段逐一复制；引用字段中 `CustomEscapes`、`CustomTypeEncoders` 两个 map 与 `CustomValidators`、`AdditionalDangerousPatterns`、`Hooks` 三个切片做深拷贝、可独立修改；接口字段（`CustomEncoder`、`CustomPathParser`）为浅拷贝（通常是无状态或单例实现）。对 nil Config 调用返回 nil。

```go
cfg := json.DefaultConfig()
cfgCopy := cfg.Clone()
cfgCopy.EnableMetrics = true // 不影响原配置
```

### Validate

签名：`func (c *Config) Validate() error`

验证配置并自动修正无效值。此方法会**原地修改** Config，将不合法的字段修正到有效范围内：过小（≤0）取最小值，过大（超出上限）取最大值。对 nil Config 调用返回错误。修正后始终返回 nil——需要查看修正了什么请用 `ValidateWithWarnings`。

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1 // 无效值
if err := cfg.Validate(); err != nil {
    panic(err)
}
// MaxJSONSize 会被原地修正为最小值
```

### ValidateWithWarnings

签名：`func (c *Config) ValidateWithWarnings() []ConfigWarning`

验证配置并返回修正警告列表。

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1
warnings := cfg.ValidateWithWarnings()
for _, w := range warnings {
    fmt.Printf("%s: %s\n", w.Field, w.Reason)
}
```

**钳制范围速查**（`Validate`/`ValidateWithWarnings` 的自动修正规则，≤0 视为无效取下限，超上限取上限）：

| 字段 | 有效范围（下限–上限） | 备注 |
|------|----------------------|------|
| `MaxJSONSize` | 1MB – 100MB | int64 |
| `MaxPathDepth` | 10 – 200 | |
| `MaxNestingDepthSecurity` | 10 – 200 | |
| `MaxConcurrency` | 1 – 200 | ≤0 重置为默认 50（而非下限 1） |
| `ParallelThreshold` | 1 – 50 | |
| `MaxObjectKeys` | 100 – 100000 | |
| `MaxArrayElements` | 100 – 100000 | |
| `MaxSecurityValidationSize` | 1MB – 100MB | int64 |
| `MaxBatchSize` | 10 – 10000 | |
| `MaxCacheSize` | 0 – 2000（仅负数视为无效） | 负数时置 0 并**同时关闭 EnableCache**（0 表示禁用缓存，合法） |
| `CacheTTL` | ≤0 无效，重置为 `DefaultCacheTTL`（5 分钟） | |
| `MaxDepth` | [0, 1000]，越界重置为 100 | 0 表示不限深度，负数无效 |
| `FloatPrecision` | [-1, 15]，越界重置为 -1 | -1 为自动精度哨兵值 |
| `ChunkSize` | 64KB – 100MB | |
| `MaxMemory` | 10MB – 1GB | |
| `BufferSize` | 4KB – 1MB | |
| `SampleSize` | 100 – 10000 | |
| `JSONLBufferSize` | 4KB – 1MB | |
| `JSONLMaxLineSize` | 1KB – 100MB | |
| `JSONLWorkers` | 1 – 64 | |
| `JSONLChunkSize` | 100 – 10000 | |
| `JSONLMaxMemory` | 10MB – 1GB | int64 |
| `MaxOperationsPerSecond` | [0, 1000000]，负数重置为 0（禁用限速） | 速率上限 |
| `SaveFileMode` | 掩码为权限位（≤ 0777） | 含 `os.ModeDir` 等多余位时被掩码并告警 |
| `AllowedFileDirs` | 条目规范化 | 相对路径解析为绝对路径（并告警）、空条目/无法解析的条目被丢弃（并告警） |

### ConfigWarning 类型

`ConfigWarning` 表示配置验证期间自动修正的信息。

```go
type ConfigWarning struct {
    Field    string // 被修正的字段名
    OldValue any    // 原始值（无效值可能为 nil）
    NewValue any    // 修正后的值
    Reason   string // 修正原因
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `Field` | `string` | 被修正的字段名（如 `MaxJSONSize`） |
| `OldValue` | `any` | 修正前的值（无效值可能为 nil） |
| `NewValue` | `any` | 修正后的值 |
| `Reason` | `string` | 修正原因（如低于下限、超出上限） |

### 安全相关字段总览

安全限制不设独立的汇总类型，直接以下列 Config 字段提供：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `MaxJSONSize` | `int64` | 100MB | 输入 JSON 大小上限（`ErrSizeLimit`） |
| `MaxPathDepth` | `int` | 50 | 路径段数上限（`ErrInvalidPath`） |
| `MaxBatchSize` | `int` | 2000 | 批处理操作的单批数量上限（`ErrSizeLimit`） |
| `MaxNestingDepthSecurity` | `int` | 200（`DefaultMaxNestingDepth`，Validate 钳制 10–200） | 输入嵌套深度上限（`ErrDepthLimit`）；与编码/解码嵌套深度 `MaxDepth`（默认 100）语义不同，勿混淆 |
| `MaxSecurityValidationSize` | `int64` | 10MB | 安全校验的大小阈值（阈值型） |
| `MaxObjectKeys` | `int` | 100000 | 对象最大键数（`ErrSizeLimit`） |
| `MaxArrayElements` | `int` | 100000 | 数组最大元素数（`ErrSizeLimit`） |
| `FullSecurityScan` | `bool` | `false`（分层扫描） | 是否对所有输入做全量安全扫描（设为 `true` 时全量） |

### AddHook

签名：`func (c *Config) AddHook(hook Hook)`

添加操作钩子。

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
```

### AddValidator

<Badge type="danger" text="已废弃" />

签名：`func (c *Config) AddValidator(validator Validator)`

添加自定义验证器（追加到 `CustomValidators`）。

::: warning 已废弃
`AddValidator` 添加的验证器**不会被任何公开操作执行**（`CustomValidators` 未在操作流水线中挂接）。操作前的自定义检查请改用 `AddHook` + Before 钩子（如 [`ValidationHook`](../extensions/hooks)）。本方法在 v1 生命周期内保留、不会移除。
:::

```go
cfg := json.DefaultConfig()
cfg.AddValidator(&MyValidator{}) // 已废弃：验证器不会被执行
```

### AddDangerousPattern

签名：`func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

添加额外安全模式。

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

## 使用示例

### 基础使用

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 安全配置

```go
// 处理不可信输入
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 格式化输出

```go
// 格式化 JSON
result, err := json.Encode(data, json.PrettyConfig())
```

### 自定义配置

```go
cfg := json.DefaultConfig()

// 安全设置
cfg.MaxJSONSize = 10 * 1024 * 1024 // 10MB
cfg.MaxNestingDepthSecurity = 50
cfg.FullSecurityScan = true

// 钩子（操作拦截与自定义校验的推荐方式）
cfg.AddHook(json.LoggingHook(slog.Default()))
cfg.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    return nil // 自定义检查
}))

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 克隆和修改

```go
// 基于默认配置创建变体
base := json.DefaultConfig()

// 变体 1：开发配置
devCfg := base.Clone()
devCfg.EnableMetrics = true

// 变体 2：生产配置
prodCfg := base.Clone()
prodCfg.FullSecurityScan = true
```

## 配置常量

```go
const (
    // 大小限制
    DefaultMaxJSONSize       = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth   = 200
    DefaultMaxPathDepth      = 50
    DefaultMaxDepth          = 100                 // 编解码默认嵌套深度（Config.MaxDepth）
    DefaultMaxConcurrency    = 50
    DefaultMaxBatchSize      = 2000
    DefaultMaxSecuritySize   = 10 * 1024 * 1024   // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultParallelThreshold = 10

    // 缓存
    DefaultCacheTTL = 5 * time.Minute
)
```

::: info 内部常量
路径验证长度限制（`maxPathLength`）等常量已转为内部实现，不再作为公开 API 导出。相关默认值通过 `Config` 结构体的字段默认值体现。
:::

---

## 合并模式

`MergeMode` 控制 `MergeJSON` 和 `MergeMany` 函数的合并策略。

`MergeMode` 实现 `fmt.Stringer`：`func (m MergeMode) String() string` 返回 `"union"` / `"intersection"` / `"difference"`（未知值返回 `"unknown(N)"`），便于日志与调试输出。

| 常量               | 值 | `String()` 返回     |
| ------------------ | -- | ------------------- |
| `MergeUnion`       | 0  | `"union"`           |
| `MergeIntersection` | 1 | `"intersection"`    |
| `MergeDifference`  | 2  | `"difference"`      |

### MergeUnion（默认）

合并所有键/元素，冲突时使用覆盖值。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeUnion
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 结果：{"a": 1, "b": 3, "c": 4}
```

### MergeIntersection

只保留两个对象中都存在的键。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 结果：{"b": 3}
```

### MergeDifference

只保留基础对象中存在但覆盖对象中不存在的键。

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// 结果：{"a": 1}
```

---

## 安全建议

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| MaxJSONSize | 10-100MB | 根据服务器内存调整 |
| MaxNestingDepthSecurity | 30-50 | 防止深度嵌套攻击 |
| MaxPathDepth | 30-50 | 限制路径复杂度 |
| SkipValidation | false | 保持输入校验开启（默认即开启，勿关闭；EnableValidation 已废弃、不被读取） |
| FullSecurityScan | true（不可信输入） | 完整安全扫描 |

## 相关

- [Processor](./processor/) - 处理器方法
- [常量与错误](./constants) - 配置常量
- [安全概述](../security/) - 安全最佳实践
- [接口定义](./interfaces) - 扩展接口
