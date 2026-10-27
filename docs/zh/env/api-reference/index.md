---
sidebar_label: "API 导览"
title: "API 参考 - CyberGo env | 完整接口文档"
description: "CyberGo env 完整 API 参考导航，涵盖包级便捷函数、Config 配置、Loader 加载器、SecureValue 安全值、核心接口定义、ComponentFactory 组件工厂与常量错误等七大模块的详细入口与方法签名索引。"
sidebar_position: 1
---

# API 参考

env 库公开 API 的完整参考，按功能模块给出入口，并在文末提供跨页面的符号索引。

## 核心 API

- [包函数](./functions)：包级便捷函数完整列表
- [Loader API](./loader)：加载器类型与方法
- [Config API](./config)：配置选项与预设
- [SecureValue API](./secure-value)：安全值处理

## 类型与接口

- [接口定义](./interfaces)：所有接口类型定义
- [常量与错误](./constants)：常量、哨兵错误和错误类型
- [组件工厂](./factory)：ComponentFactory 与扩展点

## 符号索引

按功能分组汇总各 API 页面的主要符号。同名的方法与包级函数（如 `GetString`）分别在「包级便捷函数」与「Loader 方法」两组各占一行；标注（未导出）的符号是库内部名称，无法通过 `env` 包直接引用。

### 包级便捷函数

| 符号 | 说明 | 页面 |
|------|------|------|
| `Load` | 初始化默认加载器 | [包函数](./functions#load) |
| `LoadWithConfig` | 按配置初始化 | [包函数](./functions#loadwithconfig) |
| `Overload` | 后加载覆盖初始化 | [包函数](./functions#overload) |
| `ResetDefaultLoader` | 重置默认加载器 | [包函数](./functions#resetdefaultloader) |
| `ClearInternCache` | 释放键驻留缓存 | [包函数](./functions#clearinterncache) |
| `GetString` | 读字符串值 | [包函数](./functions#getstring) |
| `GetInt` | 读 int64 | [包函数](./functions#getint) |
| `GetBool` | 读布尔值 | [包函数](./functions#getbool) |
| `GetUint64` | 读 uint64 | [包函数](./functions#getuint64) |
| `GetFloat64` | 读 float64 | [包函数](./functions#getfloat64) |
| `GetDuration` | 读时间间隔 | [包函数](./functions#getduration) |
| `GetSlice` | 泛型读切片 | [包函数](./functions#getslice-t) |
| `GetSliceFrom` | 从实例读切片 | [包函数](./functions#getslicefrom-t) |
| `GetSecure` | 读敏感值 | [包函数](./functions#getsecure) |
| `Lookup` | 查键是否存在 | [包函数](./functions#lookup) |
| `Keys` | 所有键名 | [包函数](./functions#keys) |
| `All` | 全部键值对 | [包函数](./functions#all) |
| `Len` | 变量数量 | [包函数](./functions#len) |
| `Set` | 设置变量 | [包函数](./functions#set) |
| `Delete` | 删除变量 | [包函数](./functions#delete) |
| `Validate` | 校验必需键 | [包函数](./functions#validate) |
| `ParseInto` | 映射到结构体 | [包函数](./functions#parseinto) |
| `Marshal` | 序列化为字符串 | [包函数](./functions#marshal) |
| `UnmarshalMap` | 解析为 map | [包函数](./functions#unmarshalmap) |
| `UnmarshalStruct` | 解析到结构体 | [包函数](./functions#unmarshalstruct) |
| `UnmarshalMapWithConfig` | 带配置解析为 map | [包函数](./functions#unmarshalmapwithconfig) |
| `UnmarshalStructWithConfig` | 带配置解析到结构体 | [包函数](./functions#unmarshalstructwithconfig) |
| `UnmarshalInto` | map 填入结构体 | [包函数](./functions#unmarshalinto) |
| `MarshalStruct` | 结构体转 map | [包函数](./functions#marshalstruct) |
| `IsMarshalError` | 判断序列化错误 | [包函数](./functions#ismarshalerror) |

### Loader 方法

| 符号 | 说明 | 页面 |
|------|------|------|
| `New` | 创建加载器实例 | [Loader](./loader#new) |
| `LoadFiles` | 加载多格式文件 | [Loader](./loader#loadfiles) |
| `GetString` | 读字符串值 | [Loader](./loader#getstring) |
| `GetInt` | 读 int64 | [Loader](./loader#getint) |
| `GetBool` | 读布尔值 | [Loader](./loader#getbool) |
| `GetUint64` | 读 uint64 | [Loader](./loader#getuint64) |
| `GetFloat64` | 读 float64 | [Loader](./loader#getfloat64) |
| `GetDuration` | 读时间间隔 | [Loader](./loader#getduration) |
| `GetSecure` | 读敏感值副本 | [Loader](./loader#getsecure) |
| `Lookup` | 查键是否存在 | [Loader](./loader#lookup) |
| `Set` | 设置变量 | [Loader](./loader#set) |
| `Delete` | 删除变量 | [Loader](./loader#delete) |
| `Keys` | 所有键名 | [Loader](./loader#keys) |
| `All` | 全部键值对 | [Loader](./loader#all) |
| `Len` | 变量数量 | [Loader](./loader#len) |
| `Apply` | 应用到系统环境 | [Loader](./loader#apply) |
| `IsApplied` | 是否已应用 | [Loader](./loader#isapplied) |
| `LoadTime` | 最后加载时间 | [Loader](./loader#loadtime) |
| `Config` | 配置只读副本 | [Loader](./loader#config) |
| `Validate` | 校验必需键 | [Loader](./loader#validate) |
| `ParseInto` | 映射到结构体 | [Loader](./loader#parseinto) |
| `Close` | 关闭并清零 | [Loader](./loader#close) |
| `IsClosed` | 是否已关闭 | [Loader](./loader#isclosed) |

### Config 配置

| 符号 | 说明 | 页面 |
|------|------|------|
| `Config` | 配置结构体 | [Config](./config#结构体定义) |
| `FileConfig`、`ValidationConfig`、`LimitsConfig`、`JSONConfig`、`YAMLConfig`、`ParsingConfig`、`ComponentConfig` | 七个嵌套配置段 | [Config](./config#嵌套结构体) |
| `Filenames`、`OverwriteExisting`、`MaxFileSize`、`KeyPattern`、`AuditEnabled` 等 | 全部配置字段 | [Config](./config#配置字段) |
| `Validate` | 校验配置合法性 | [Config](./config#validate) |
| `IsZero` | 是否零值配置 | [Config](./config#iszero) |
| `ExpansionScope` | 展开作用域枚举 | [Config](./config#expansionscope) |
| `ExpansionFileThenProcess`、`ExpansionFileOnly` | 作用域常量 | [Config](./config#expansionscope) |
| `DuplicateKeyPolicy` | 单文档重复键枚举 | [Config](./config#duplicatekeypolicy-单文档内重复键) |
| `DuplicateKeyInherit`、`DuplicateKeyFirstWins`、`DuplicateKeyLastWins`、`DuplicateKeyError` | 重复键策略常量 | [Config](./config#duplicatekeypolicy-单文档内重复键) |
| `AuditFailClosed` | fail-closed 审计开关 | [Config](./config#auditfailclosed-bool) |

### 预设、工厂与格式

| 符号 | 说明 | 页面 |
|------|------|------|
| `DefaultConfig` | 默认安全配置 | [Config](./config#defaultconfig) |
| `DevelopmentConfig` | 开发宽松预设 | [Config](./config#developmentconfig) |
| `TestingConfig` | 测试隔离预设 | [Config](./config#testingconfig) |
| `ProductionConfig` | 生产严格预设 | [Config](./config#productionconfig) |
| `ComponentFactory` | 组件工厂类型 | [组件工厂](./factory#类型定义) |
| `Validator` | 取验证器组件 | [组件工厂](./factory#validator) |
| `Auditor` | 取审计器组件 | [组件工厂](./factory#auditor) |
| `Expander` | 取展开器组件 | [组件工厂](./factory#expander) |
| `Close` | 关闭工厂资源 | [组件工厂](./factory#close) |
| `IsClosed` | 工厂是否已关闭 | [组件工厂](./factory#isclosed) |
| `RegisterParser` | 注册自定义解析器 | [组件工厂](./factory#registerparser) |
| `ForceRegisterParser` | 强制覆盖注册 | [组件工厂](./factory#forceregisterparser) |
| `ParserFactory` | 解析器工厂签名 | [组件工厂](./factory#parserfactory-类型) |
| `DetectFormat` | 检测文件格式 | [组件工厂](./factory#detectformat) |
| `FileFormat` | 文件格式枚举 | [组件工厂](./factory#fileformat-常量) |
| `FormatAuto`、`FormatEnv`、`FormatJSON`、`FormatYAML` | 内置格式常量 | [组件工厂](./factory#fileformat-常量) |
| `String`（`FileFormat` 方法） | 返回格式名 | [组件工厂](./factory#fileformat-string) |
| `OSFileSystem` | 操作系统实现 | [组件工厂](./factory#osfilesystem) |
| `DefaultFileSystem` | 默认实例变量 | [组件工厂](./factory#defaultfilesystem) |

### SecureValue 与内存锁定

| 符号 | 说明 | 页面 |
|------|------|------|
| `SecureValue` | 安全值类型 | [SecureValue](./secure-value) |
| `NewSecureValue` | 创建安全值 | [SecureValue](./secure-value#newsecurevalue) |
| `NewSecureValueStrict` | 创建并在锁定失败时返回错误 | [SecureValue](./secure-value#newsecurevaluestrict) |
| `String` | 掩码字符串化 | [SecureValue](./secure-value#string) |
| `Reveal` | 读取明文 | [SecureValue](./secure-value#reveal) |
| `Bytes` | 字节副本 | [SecureValue](./secure-value#bytes) |
| `Length` | 值长度 | [SecureValue](./secure-value#length) |
| `Masked` | 掩码表示 | [SecureValue](./secure-value#masked) |
| `MarshalJSON` | JSON 掩码输出 | [SecureValue](./secure-value#marshaljson) |
| `MarshalText` | 文本掩码输出 | [SecureValue](./secure-value#marshaltext) |
| `Close` | 清零不归池 | [SecureValue](./secure-value#close) |
| `Release` | 清零并归池 | [SecureValue](./secure-value#release) |
| `IsClosed` | 是否已关闭 | [SecureValue](./secure-value#isclosed) |
| `IsMemoryLocked` | 内存是否锁定 | [SecureValue](./secure-value#ismemorylocked) |
| `MemoryLockError` | 锁定失败错误 | [SecureValue](./secure-value#memorylockerror) |
| `SetMemoryLockEnabled` | 全局启用内存锁定 | [SecureValue](./secure-value#setmemorylockenabled) |
| `IsMemoryLockEnabled` | 查询全局开关 | [SecureValue](./secure-value#ismemorylockenabled) |
| `SetMemoryLockStrict` | 严格模式告警 | [SecureValue](./secure-value#setmemorylockstrict) |
| `IsMemoryLockStrict` | 查询严格模式 | [SecureValue](./secure-value#ismemorylockstrict) |
| `IsMemoryLockSupported` | 平台是否支持 | [SecureValue](./secure-value#ismemorylocksupported) |

### 安全工具函数

| 符号 | 说明 | 页面 |
|------|------|------|
| `ClearBytes` | 清零字节切片 | [SecureValue](./secure-value#clearbytes) |
| `IsSensitiveKey` | 键名是否敏感 | [SecureValue](./secure-value#issensitivekey) |
| `MaskValue` | 按键掩码值 | [SecureValue](./secure-value#maskvalue) |
| `MaskKey` | 掩码键名 | [SecureValue](./secure-value#maskkey) |
| `SanitizeForLog` | 日志脱敏 | [SecureValue](./secure-value#sanitizeforlog) |
| `MaskSensitiveInString` | 截断并掩码长字符串 | [SecureValue](./secure-value#masksensitiveinstring) |

### 审计

| 符号 | 说明 | 页面 |
|------|------|------|
| `AuditLogger` | 最小审计接口 | [接口定义](./interfaces#auditlogger) |
| `FullAuditLogger` | 完整审计接口 | [接口定义](./interfaces#fullauditlogger) |
| `AuditHandler` | 处理器接口 | [接口定义](./interfaces#audithandler) |
| `AuditEvent` | 审计事件结构 | [接口定义](./interfaces#auditevent) |
| `AuditAction` | 动作类型 | [接口定义](./interfaces#auditaction) |
| `ActionLoad`、`ActionParse`、`ActionGet`、`ActionSet`、`ActionDelete`、`ActionValidate`、`ActionExpand`、`ActionSecurity`、`ActionError`、`ActionFileAccess` | 十个动作常量 | [接口定义](./interfaces#auditaction) |
| `NewJSONAuditHandler` | JSON 处理器 | [组件工厂](./factory#newjsonaudithandler) |
| `NewLogAuditHandler` | 标准日志处理器 | [组件工厂](./factory#newlogaudithandler) |
| `NewChannelAuditHandler` | 通道处理器 | [组件工厂](./factory#newchannelaudithandler) |
| `NewNopAuditHandler` | 空操作处理器 | [组件工厂](./factory#newnopaudithandler) |
| `NewCloseableChannelHandler`、`CloseableChannelHandler` | 自管通道处理器 | [组件工厂](./factory#newcloseablechannelhandler) |
| `JSONAuditHandler`、`LogAuditHandler`、`ChannelAuditHandler`、`NopAuditHandler` | 处理器实现类型 | [接口定义](./interfaces#jsonaudithandler) |

### 错误与哨兵

| 符号 | 说明 | 页面 |
|------|------|------|
| `ErrFileNotFound`、`ErrFileTooLarge` | 文件哨兵 | [常量与错误](./constants#文件错误) |
| `ErrLineTooLong`、`ErrInvalidKey`、`ErrDuplicateKey` | 解析哨兵 | [常量与错误](./constants#解析错误) |
| `ErrForbiddenKey`、`ErrSecurityViolation`、`ErrInvalidValue` | 安全哨兵 | [常量与错误](./constants#安全错误) |
| `ErrExpansionDepth` | 展开哨兵 | [常量与错误](./constants#展开错误) |
| `ErrMaxVariables` | 限制哨兵 | [常量与错误](./constants#限制错误) |
| `ErrClosed`、`ErrInvalidConfig`、`ErrAlreadyInitialized`、`ErrNotInitialized`、`ErrMissingRequired` | 状态哨兵 | [常量与错误](./constants#状态错误) |
| `ErrAuditFailed` | 审计失败哨兵 | [常量与错误](./constants#状态错误) |
| `ErrValidateRequiredUnsupported` | 适配器哨兵 | [常量与错误](./constants#适配器错误) |
| `ParseError` | 解析错误类型 | [常量与错误](./constants#parseerror) |
| `ValidationError` | 验证错误类型 | [常量与错误](./constants#validationerror) |
| `SecurityError` | 安全错误类型 | [常量与错误](./constants#securityerror) |
| `FileError` | 文件错误类型 | [常量与错误](./constants#fileerror) |
| `ExpansionError` | 展开错误类型 | [常量与错误](./constants#expansionerror) |
| `ExpansionErrorKind`、`ExpansionDepthKind`、`ExpansionRequiredKind` | 错误分类类型与常量 | [常量与错误](./constants#expansionerror) |
| `JSONError` | JSON 解析错误 | [常量与错误](./constants#jsonerror) |
| `YAMLError` | YAML 解析错误 | [常量与错误](./constants#yamlerror) |
| `MarshalError` | 序列化错误类型 | [常量与错误](./constants#marshalerror) |

### 常量与限制

| 符号 | 说明 | 页面 |
|------|------|------|
| `DefaultMaxFileSize`、`DefaultMaxLineLength`、`DefaultMaxKeyLength`、`DefaultMaxValueLength`、`DefaultMaxVariables`、`DefaultMaxExpansionDepth` | 默认限制常量 | [常量与错误](./constants#默认限制) |
| `DefaultKeyPattern` | 默认键名模式 | [常量与错误](./constants#defaultkeypattern) |
| `defaultForbiddenKeysSlice`（未导出） | 内置禁止键 | [常量与错误](./constants#defaultforbiddenkeys) |
| `internal.Patterns`（未导出） | 敏感键模式 | [常量与错误](./constants#sensitivekeypatterns) |
| 硬性上限（未导出） | 100 MB、64 KB 等 | [常量与错误](./constants#硬性上限) |

### 接口

| 符号 | 说明 | 页面 |
|------|------|------|
| `EnvLoader` | 组合加载器接口 | [接口定义](./interfaces#envloader) |
| `EnvFileLoader` | 文件加载接口 | [接口定义](./interfaces#envfileloader) |
| `EnvGetter` | 只读访问接口 | [接口定义](./interfaces#envgetter) |
| `EnvSetter` | 写入访问接口 | [接口定义](./interfaces#envsetter) |
| `EnvApplicator` | 应用到系统 | [接口定义](./interfaces#envapplicator) |
| `EnvCloser` | 资源释放接口 | [接口定义](./interfaces#envcloser) |
| `Validator` | 组合验证接口 | [接口定义](./interfaces#validator) |
| `KeyValidator` | 键验证接口 | [接口定义](./interfaces#keyvalidator) |
| `ValueValidator` | 值验证接口 | [接口定义](./interfaces#valuevalidator) |
| `RequiredValidator` | 必需键验证接口 | [接口定义](./interfaces#requiredvalidator) |
| `VariableExpander` | 变量展开接口 | [接口定义](./interfaces#variableexpander) |
| `EnvParser` | 解析器接口 | [接口定义](./interfaces#envparser) |
| `EnvStorage` | 存储后端接口 | [接口定义](./interfaces#envstorage) |
| `Marshaler` | 自定义序列化 | [接口定义](./interfaces#marshaler) |
| `Unmarshaler` | 自定义反序列化 | [接口定义](./interfaces#unmarshaler) |
| `FileSystem` | 文件系统抽象 | [接口定义](./interfaces#filesystem) |
| `File` | 文件操作接口 | [接口定义](./interfaces#file) |
