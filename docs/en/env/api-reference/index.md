---
sidebar_label: "API Overview"
title: "API Reference - CyberGo env | Complete Interface Docs"
description: "API reference for CyberGo env: package functions, Config, Loader, SecureValue, interfaces, ComponentFactory, and constants with a linked symbol index."
sidebar_position: 1
---

# API Reference

Complete API reference documentation for the env library.

## Core API

- [Package Functions](./functions) - Complete list of package-level convenience functions
- [Loader API](./loader) - Loader type and methods
- [Config API](./config) - Configuration options and presets
- [SecureValue API](./secure-value) - Secure value handling

## Types and Interfaces

- [Interfaces](./interfaces) - All interface type definitions
- [Constants & Errors](./constants) - Constants, sentinel errors, and error types
- [Component Factory](./factory) - ComponentFactory and extension points

## Symbol Index

The major symbols from every API reference page, grouped by function, each linking straight to its documentation. Same-named methods and package functions (e.g. `GetString`) get one row each under "Package-Level Functions" and "Loader Methods"; symbols marked (unexported) are internal library names that cannot be referenced through the `env` package.

### Package-Level Functions

| Symbol | Description | Page |
|--------|-------------|------|
| `Load` | Init default loader | [functions](./functions#load) |
| `LoadWithConfig` | Init with Config | [functions](./functions#loadwithconfig) |
| `Overload` | last-file-wins initializer | [functions](./functions#overload) |
| `ResetDefaultLoader` | Reset default loader | [functions](./functions#resetdefaultloader) |
| `GetString` | Read string | [functions](./functions#getstring) |
| `GetInt` | Read int64 | [functions](./functions#getint) |
| `GetBool` | Read bool | [functions](./functions#getbool) |
| `GetUint64` | Read uint64 | [functions](./functions#getuint64) |
| `GetFloat64` | Read float64 | [functions](./functions#getfloat64) |
| `GetDuration` | Read duration | [functions](./functions#getduration) |
| `GetSlice` | Generic slice read | [functions](./functions#getslice-t) |
| `GetSliceFrom` | Slice from instance | [functions](./functions#getslicefrom-t) |
| `GetSecure` | Read secret | [functions](./functions#getsecure) |
| `Lookup` | Key existence check | [functions](./functions#lookup) |
| `Keys` | All key names | [functions](./functions#keys) |
| `All` | Full key/value map | [functions](./functions#all) |
| `Len` | Variable count | [functions](./functions#len) |
| `Set` | Set variable | [functions](./functions#set) |
| `Delete` | Delete variable | [functions](./functions#delete) |
| `Validate` | Check required keys | [functions](./functions#validate) |
| `ParseInto` | Map to struct | [functions](./functions#parseinto) |
| `Marshal` | Serialize to string | [functions](./functions#marshal) |
| `UnmarshalMap` | Parse to map | [functions](./functions#unmarshalmap) |
| `UnmarshalStruct` | Parse into struct | [functions](./functions#unmarshalstruct) |
| `UnmarshalMapWithConfig` | Parse to map with config | [functions](./functions#unmarshalmapwithconfig) |
| `UnmarshalStructWithConfig` | Parse into struct with config | [functions](./functions#unmarshalstructwithconfig) |
| `UnmarshalInto` | Fill struct from map | [functions](./functions#unmarshalinto) |
| `MarshalStruct` | Struct to map | [functions](./functions#marshalstruct) |
| `IsMarshalError` | Marshal error check | [functions](./functions#ismarshalerror) |

### Loader Methods

| Symbol | Description | Page |
|--------|-------------|------|
| `New` | Create Loader | [loader](./loader#new) |
| `LoadFiles` | Load multi-format files | [loader](./loader#loadfiles) |
| `GetString` | Read string | [loader](./loader#getstring) |
| `GetInt` | Read int64 | [loader](./loader#getint) |
| `GetBool` | Read bool | [loader](./loader#getbool) |
| `GetUint64` | Read uint64 | [loader](./loader#getuint64) |
| `GetFloat64` | Read float64 | [loader](./loader#getfloat64) |
| `GetDuration` | Read duration | [loader](./loader#getduration) |
| `GetSecure` | Read secret copy | [loader](./loader#getsecure) |
| `Lookup` | Key existence check | [loader](./loader#lookup) |
| `Set` | Set variable | [loader](./loader#set) |
| `Delete` | Delete variable | [loader](./loader#delete) |
| `Keys` | All key names | [loader](./loader#keys) |
| `All` | Full key/value map | [loader](./loader#all) |
| `Len` | Variable count | [loader](./loader#len) |
| `Apply` | Apply to os.Environ | [loader](./loader#apply) |
| `IsApplied` | Applied flag | [loader](./loader#isapplied) |
| `LoadTime` | Last load time | [loader](./loader#loadtime) |
| `Config` | Read-only config copy | [loader](./loader#config) |
| `Validate` | Check required keys | [loader](./loader#validate) |
| `ParseInto` | Map to struct | [loader](./loader#parseinto) |
| `Close` | Close and zero | [loader](./loader#close) |
| `IsClosed` | Closed flag | [loader](./loader#isclosed) |

### Config

| Symbol | Description | Page |
|--------|-------------|------|
| `Config` | Configuration struct | [config](./config#struct-definition) |
| `FileConfig`, `ValidationConfig`, `LimitsConfig`, `JSONConfig`, `YAMLConfig`, `ParsingConfig`, `ComponentConfig` | Seven nested sections | [config](./config#nested-structs) |
| `Filenames`, `OverwriteExisting`, `MaxFileSize`, `KeyPattern`, `AuditEnabled`, etc. | All config fields | [config](./config#configuration-fields) |
| `Validate` | Validate config | [config](./config#validate) |
| `IsZero` | Zero-value check | [config](./config#iszero) |
| `ExpansionScope` | Expansion scope enum | [config](./config#expansionscope) |
| `ExpansionFileThenProcess`, `ExpansionFileOnly` | Scope constants | [config](./config#expansionscope) |
| `DuplicateKeyPolicy` | In-document duplicate-key enum | [config](./config#duplicatekeypolicy-in-document-duplicate-keys) |
| `DuplicateKeyInherit`, `DuplicateKeyFirstWins`, `DuplicateKeyLastWins`, `DuplicateKeyError` | Duplicate-key policy constants | [config](./config#duplicatekeypolicy-in-document-duplicate-keys) |
| `AuditFailClosed` | Fail-closed audit switch | [config](./config#auditfailclosed-bool) |

### Presets, Factory, and Formats

| Symbol | Description | Page |
|--------|-------------|------|
| `DefaultConfig` | Safe defaults | [config](./config#defaultconfig) |
| `DevelopmentConfig` | Relaxed dev preset | [config](./config#developmentconfig) |
| `TestingConfig` | Test-isolation preset | [config](./config#testingconfig) |
| `ProductionConfig` | Strict prod preset | [config](./config#productionconfig) |
| `ComponentFactory` | Component factory type | [factory](./factory#type-definition) |
| `Validator` | Factory: validator | [factory](./factory#validator) |
| `Auditor` | Factory: auditor | [factory](./factory#auditor) |
| `Expander` | Factory: expander | [factory](./factory#expander) |
| `Close` | Factory: release | [factory](./factory#close) |
| `IsClosed` | Factory: closed flag | [factory](./factory#isclosed) |
| `RegisterParser` | Register parser | [factory](./factory#registerparser) |
| `ForceRegisterParser` | Override builtin | [factory](./factory#forceregisterparser) |
| `ParserFactory` | Parser factory sig | [factory](./factory#parserfactory-type) |
| `DetectFormat` | Detect file format | [factory](./factory#detectformat) |
| `FileFormat` | Format enum | [factory](./factory#fileformat-constants) |
| `FormatAuto`, `FormatEnv`, `FormatJSON`, `FormatYAML` | Builtin format constants | [factory](./factory#fileformat-constants) |
| `String` (`FileFormat` method) | Format name | [factory](./factory#fileformat-string) |
| `OSFileSystem` | OS implementation | [factory](./factory#osfilesystem) |
| `DefaultFileSystem` | Default instance | [factory](./factory#defaultfilesystem) |

### SecureValue and Memory Locking

| Symbol | Description | Page |
|--------|-------------|------|
| `SecureValue` | Secure value type | [secure-value](./secure-value) |
| `NewSecureValue` | Create secure value | [secure-value](./secure-value#newsecurevalue) |
| `NewSecureValueStrict` | Error on lock failure | [secure-value](./secure-value#newsecurevaluestrict) |
| `String` | Masked stringer | [secure-value](./secure-value#string) |
| `Reveal` | Read plaintext | [secure-value](./secure-value#reveal) |
| `Bytes` | Byte copy | [secure-value](./secure-value#bytes) |
| `Length` | Value length | [secure-value](./secure-value#length) |
| `Masked` | Masked form | [secure-value](./secure-value#masked) |
| `MarshalJSON` | Masked JSON output | [secure-value](./secure-value#marshaljson) |
| `MarshalText` | Masked text output | [secure-value](./secure-value#marshaltext) |
| `Close` | Zero, no pool return | [secure-value](./secure-value#close) |
| `Release` | Zero and pool return | [secure-value](./secure-value#release) |
| `IsClosed` | Closed flag | [secure-value](./secure-value#isclosed) |
| `IsMemoryLocked` | Memory lock state | [secure-value](./secure-value#ismemorylocked) |
| `MemoryLockError` | Lock error | [secure-value](./secure-value#memorylockerror) |
| `SetMemoryLockEnabled` | Global lock switch | [secure-value](./secure-value#setmemorylockenabled) |
| `IsMemoryLockEnabled` | Query global switch | [secure-value](./secure-value#ismemorylockenabled) |
| `SetMemoryLockStrict` | Strict-mode warnings | [secure-value](./secure-value#setmemorylockstrict) |
| `IsMemoryLockStrict` | Query strict mode | [secure-value](./secure-value#ismemorylockstrict) |
| `IsMemoryLockSupported` | Platform support | [secure-value](./secure-value#ismemorylocksupported) |

### Security Utilities

| Symbol | Description | Page |
|--------|-------------|------|
| `ClearBytes` | Zero byte slice | [secure-value](./secure-value#clearbytes) |
| `IsSensitiveKey` | Sensitive key check | [secure-value](./secure-value#issensitivekey) |
| `MaskValue` | Mask value by key | [secure-value](./secure-value#maskvalue) |
| `MaskKey` | Mask key name | [secure-value](./secure-value#maskkey) |
| `SanitizeForLog` | Log redaction | [secure-value](./secure-value#sanitizeforlog) |
| `MaskSensitiveInString` | Truncate long strings | [secure-value](./secure-value#masksensitiveinstring) |

### Auditing

| Symbol | Description | Page |
|--------|-------------|------|
| `AuditLogger` | Minimal audit interface | [interfaces](./interfaces#auditlogger) |
| `FullAuditLogger` | Full audit interface | [interfaces](./interfaces#fullauditlogger) |
| `AuditHandler` | Handler interface | [interfaces](./interfaces#audithandler) |
| `AuditEvent` | Audit event struct | [interfaces](./interfaces#auditevent) |
| `AuditAction` | Action type | [interfaces](./interfaces#auditaction) |
| `ActionLoad`, `ActionParse`, `ActionGet`, `ActionSet`, `ActionDelete`, `ActionValidate`, `ActionExpand`, `ActionSecurity`, `ActionError`, `ActionFileAccess` | Ten action constants | [interfaces](./interfaces#auditaction) |
| `NewJSONAuditHandler` | JSON handler | [factory](./factory#newjsonaudithandler) |
| `NewLogAuditHandler` | Stdlib-log handler | [factory](./factory#newlogaudithandler) |
| `NewChannelAuditHandler` | Channel handler | [factory](./factory#newchannelaudithandler) |
| `NewNopAuditHandler` | No-op handler | [factory](./factory#newnopaudithandler) |
| `NewCloseableChannelHandler`, `CloseableChannelHandler` | Self-owned channel handler | [factory](./factory#newcloseablechannelhandler) |
| `JSONAuditHandler`, `LogAuditHandler`, `ChannelAuditHandler`, `NopAuditHandler` | Handler implementations | [interfaces](./interfaces#jsonaudithandler) |

### Errors and Sentinels

| Symbol | Description | Page |
|--------|-------------|------|
| `ErrFileNotFound`, `ErrFileTooLarge` | File sentinels | [constants](./constants#file-errors) |
| `ErrLineTooLong`, `ErrInvalidKey`, `ErrDuplicateKey` | Parse sentinels | [constants](./constants#parse-errors) |
| `ErrForbiddenKey`, `ErrSecurityViolation`, `ErrInvalidValue` | Security sentinels | [constants](./constants#security-errors) |
| `ErrExpansionDepth` | Expansion sentinel | [constants](./constants#expansion-errors) |
| `ErrMaxVariables` | Limit sentinel | [constants](./constants#limit-errors) |
| `ErrClosed`, `ErrInvalidConfig`, `ErrAlreadyInitialized`, `ErrNotInitialized`, `ErrMissingRequired` | State sentinels | [constants](./constants#state-errors) |
| `ErrAuditFailed` | audit-failure sentinel | [constants](./constants#state-errors) |
| `ErrValidateRequiredUnsupported` | Adapter sentinel | [constants](./constants#adapter-errors) |
| `ParseError` | Parse error type | [constants](./constants#parseerror) |
| `ValidationError` | Validation error type | [constants](./constants#validationerror) |
| `SecurityError` | Security error type | [constants](./constants#securityerror) |
| `FileError` | File error type | [constants](./constants#fileerror) |
| `ExpansionError` | Expansion error type | [constants](./constants#expansionerror) |
| `ExpansionErrorKind`, `ExpansionDepthKind`, `ExpansionRequiredKind` | Error kind constants | [constants](./constants#expansionerror) |
| `JSONError` | JSON parse error | [constants](./constants#jsonerror) |
| `YAMLError` | YAML parse error | [constants](./constants#yamlerror) |
| `MarshalError` | Marshal error type | [constants](./constants#marshalerror) |

### Constants and Limits

| Symbol | Description | Page |
|--------|-------------|------|
| `DefaultMaxFileSize`, `DefaultMaxLineLength`, `DefaultMaxKeyLength`, `DefaultMaxValueLength`, `DefaultMaxVariables`, `DefaultMaxExpansionDepth` | Default limit constants | [constants](./constants#default-limits) |
| `DefaultKeyPattern` | Default key pattern | [constants](./constants#defaultkeypattern) |
| `defaultForbiddenKeys` (unexported) | Builtin forbidden keys | [constants](./constants#defaultforbiddenkeys) |
| `internal.Patterns` (unexported) | Sensitive key patterns | [constants](./constants#sensitivekeypatterns) |
| Hard limits (unexported) | 100MB, 64KB, etc. | [constants](./constants#hard-limits) |

### Interfaces

| Symbol | Description | Page |
|--------|-------------|------|
| `EnvLoader` | Composite loader interface | [interfaces](./interfaces#envloader) |
| `EnvFileLoader` | File loading interface | [interfaces](./interfaces#envfileloader) |
| `EnvGetter` | Read-only access interface | [interfaces](./interfaces#envgetter) |
| `EnvSetter` | Write access interface | [interfaces](./interfaces#envsetter) |
| `EnvApplicator` | Apply to system env | [interfaces](./interfaces#envapplicator) |
| `EnvCloser` | Resource release interface | [interfaces](./interfaces#envcloser) |
| `Validator` | Composite validation interface | [interfaces](./interfaces#validator) |
| `KeyValidator` | Key validation interface | [interfaces](./interfaces#keyvalidator) |
| `ValueValidator` | Value validation interface | [interfaces](./interfaces#valuevalidator) |
| `RequiredValidator` | Required-keys interface | [interfaces](./interfaces#requiredvalidator) |
| `VariableExpander` | Variable expansion interface | [interfaces](./interfaces#variableexpander) |
| `EnvParser` | Parser interface | [interfaces](./interfaces#envparser) |
| `EnvStorage` | Storage backend interface | [interfaces](./interfaces#envstorage) |
| `Marshaler` | Custom serialization | [interfaces](./interfaces#marshaler) |
| `Unmarshaler` | Custom deserialization | [interfaces](./interfaces#unmarshaler) |
| `FileSystem` | Filesystem abstraction | [interfaces](./interfaces#filesystem) |
| `File` | File operation interface | [interfaces](./interfaces#file) |
