---
sidebar_label: "Schema Validation"
title: "Schema Validation - CyberGo JSON | JSON Schema Guide"
description: "CyberGo JSON Schema validation: ValidateSchema returns ValidationError lists for Required/Properties, Pattern/Format, Minimum/Maximum and Enum/Const."
sidebar_position: 50
---

# Schema Validation

Schema validation has two steps: define a `Schema` describing the structure and constraints your data must satisfy, then validate a piece of JSON with `ValidateSchema`. Constraint violations come back as a `[]ValidationError` slice, not as an `error`.

## The ValidateSchema Function

`ValidateSchema` validates a JSON string against a `Schema` and returns the list of all constraint violations:

```go
// Package-level function
func ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)

// Processor method
func (p *Processor) ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)
```

Return value semantics:

| Return value | Meaning |
|--------------|---------|
| `([]ValidationError{}, nil)` | The JSON is valid and **satisfies every constraint** |
| `([]ValidationError{...}, nil)` | The JSON parses, but constraint violations exist (non-empty slice) |
| `(nil, error)` | Parsing or a precondition failed (e.g. invalid JSON, nil `schema`, limit exceeded) |

:::tip The key distinction
Constraint violations live in the **returned slice** (`error` stays `nil`); only parse failures, a nil `schema`, exceeding size limits, and the like produce a non-`nil` `error`. Decide "did validation pass" with `len(errs) == 0`, not `err != nil`.
:::

## Basic Example: Object Structure and Required Fields

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	schema := &json.Schema{
		Type:     "object",
		Required: []string{"name", "email"},
		Properties: map[string]*json.Schema{
			"name":  {Type: "string"},
			"email": {Type: "string", Format: "email"},
			"age":   {Type: "number"},
		},
	}

	// The required field email is missing
	data := `{"name":"Alice","age":30}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// Output: email: required property 'email' is missing
}
```

## Schema Constraint Fields Overview

Constraint fields supported by `Schema` (grouped by category):

| Category | Field | Type | Applies to | Description |
|----------|-------|------|------------|-------------|
| Structure | `Type` | `string` | All | Values listed below |
| Structure | `Required` | `[]string` | object | List of property names that must be present |
| Structure | `Properties` | `map[string]*Schema` | object | Sub-schema for each property |
| Structure | `Items` | `*Schema` | array | Sub-schema for the elements |
| Structure | `AdditionalProperties` | `bool` | object | `true` allows extra properties, `false` rejects them |
| String | `MinLength` / `MaxLength` | `int` | string | Length range (counted by rune) |
| String | `Pattern` | `string` | string | Regular expression |
| String | `Format` | `string` | string | Semantic format (see the [Format value table](#supported-format-values)) |
| Number | `Minimum` / `Maximum` | `float64` | number / integer | Value range |
| Number | `ExclusiveMinimum` / `ExclusiveMaximum` | `bool` | number / integer | Excludes the boundary value |
| Number | `MultipleOf` | `float64` | number / integer | Must be a multiple of this value |
| Array | `MinItems` / `MaxItems` | `int` | array | Element count range |
| Array | `UniqueItems` | `bool` | array | `true` requires elements to be unique |
| Value | `Enum` | `[]any` | All | List of allowed enum values |
| Value | `Const` | `any` | All | Must equal this fixed value |
| Metadata | `Title` / `Description` | `string` | — | Documentation metadata; not validated |
| Metadata | `Default` | `any` | — | Documentation metadata; not validated |
| Metadata | `Examples` | `[]any` | — | Documentation metadata; not validated |

Supported `Type` values: `object`, `array`, `string`, `number`, `integer`, `boolean`, `null`.

::: tip Choosing between "number" and "integer"
After JSON parsing every number (integers included) is a `float64`, so `"number"` accepts every number. `"integer"` follows JSON Schema semantics and accepts values that are **mathematically integers**: `1`, `1.0`, and `1e2` all pass, while `1.5` fails with an `expected type integer, got float64` error. Numeric constraints such as `Minimum`/`Maximum`/`MultipleOf` take effect for both `number` and `integer`.
:::

## Object Constraints: Required / Properties / AdditionalProperties

`AdditionalProperties` controls whether properties not declared in `Properties` may appear. When constructing a `Schema` directly with a struct literal, the field defaults to `false` (extra properties rejected):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	schema := &json.Schema{
		Type:     "object",
		Required: []string{"name"},
		Properties: map[string]*json.Schema{
			"name":  {Type: "string"},
			"email": {Type: "string"},
		},
		// AdditionalProperties unset; struct literal defaults to false -> extra properties rejected
	}

	// "extra" is not declared in Properties
	data := `{"name":"Alice","extra":"x"}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// Output: extra: additional property 'extra' is not allowed
}
```

:::tip Allowing extra properties
To allow extra properties, set `AdditionalProperties` to `true`, or construct with [`DefaultSchema()`](#creating-a-schema) (whose default `AdditionalProperties` is `true`).
:::

## String Constraints: MinLength / MaxLength / Pattern / Format

Constraints such as `MinLength`, `MaxLength`, `Minimum`, `Maximum`, `MinItems`, `MaxItems` **take effect only when the schema is created with `NewSchema`** (see [Creating a Schema](#creating-a-schema) for why). The example sets lengths through `SchemaConfig` pointer fields and restricts values to lowercase letters with `Pattern`:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	nameCfg := json.DefaultSchemaConfig()
	nameCfg.Type = "string"
	minLen, maxLen := 3, 10
	nameCfg.MinLength = &minLen
	nameCfg.MaxLength = &maxLen
	nameCfg.Pattern = `^[a-z]+$`
	nameSchema := json.NewSchema(nameCfg)

	schema := &json.Schema{
		Type:     "object",
		Required: []string{"name"},
		Properties: map[string]*json.Schema{
			"name": nameSchema,
		},
	}

	// "AB": too short and contains uppercase letters
	data := `{"name":"AB"}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// Output:
	// name: string length 2 is less than minimum 3
	// name: string 'AB' does not match pattern '^[a-z]+$'
}
```

`Pattern` is compiled lazily on first validation and cached, so the same `*Schema` is safe for concurrent validation. If the regex itself is invalid, every validation reports that compile error.

## Numeric Constraints: Minimum / Maximum / MultipleOf

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	ageCfg := json.DefaultSchemaConfig()
	ageCfg.Type = "number"
	minVal, maxVal := 0.0, 120.0
	ageCfg.Minimum = &minVal
	ageCfg.Maximum = &maxVal
	mult := 5.0
	ageCfg.MultipleOf = &mult
	ageSchema := json.NewSchema(ageCfg)

	schema := &json.Schema{
		Type: "object",
		Properties: map[string]*json.Schema{
			"age": ageSchema,
		},
	}

	// 148: exceeds the 120 cap and is not a multiple of 5
	data := `{"age":148}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// Output:
	// age: number 148 exceeds maximum 120
	// age: number 148 is not a multiple of 5
}
```

`ExclusiveMinimum` / `ExclusiveMaximum` must be set together with `Minimum` / `Maximum`, also through `SchemaConfig` pointer fields, to exclude the boundary value itself. `MultipleOf` compares with a float tolerance (epsilon 1e-9), so IEEE 754 precision cases like `0.1 + 0.2` produce no false positives.

## Array Constraints: Items / MinItems / MaxItems / UniqueItems

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	tagsCfg := json.DefaultSchemaConfig()
	tagsCfg.Type = "array"
	minItems, maxItems := 1, 3
	tagsCfg.MinItems = &minItems
	tagsCfg.MaxItems = &maxItems
	tagsCfg.UniqueItems = true
	tagsCfg.Items = &json.Schema{Type: "string"}
	tagsSchema := json.NewSchema(tagsCfg)

	schema := &json.Schema{
		Type: "object",
		Properties: map[string]*json.Schema{
			"tags": tagsSchema,
		},
	}

	// 4 elements (exceeds the cap of 3), and "a" is duplicated
	data := `{"tags":["a","a","b","c"]}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// Output:
	// tags: array length 4 exceeds maximum 3
	// tags[1]: duplicate item found: a
}
```

`Items` specifies the sub-schema every element must satisfy (a string in the example above); `UniqueItems` judges duplicates by the combination of "**dynamic type + value**" — `[1, "1"]` counts as two distinct elements, and only genuinely duplicated values are reported.

:::tip Recursion depth protection
`Schema` is a recursive type; validation enforces a recursion-depth cap (`DefaultMaxNestingDepth` = 200). Self-referencing schemas (e.g. `s.Items = s`) do not cause stack overflow — exceeding the cap yields a `schema nesting exceeds maximum depth` error.
:::

## Enum and Const: Enum / Const

`Enum` restricts the value to one of a set; `Const` requires equality with a fixed value. Both work by direct comparison and need no `NewSchema`:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	schema := &json.Schema{
		Type: "object",
		Properties: map[string]*json.Schema{
			"role":   {Enum: []any{"admin", "user", "guest"}},
			"status": {Const: "active"},
		},
	}

	// role is not in the enum; status matches the constant
	data := `{"role":"superuser","status":"active"}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// Output: role: value 'superuser' is not in allowed enum values: [admin user guest]
}
```

## Supported Format Values

Semantic formats supported by the `Format` field (unknown formats are silently skipped: no error, no check):

| Format | Validation rule |
|--------|-----------------|
| `email` | Validates local part, domain, TLD structure, and lengths |
| `date` | `YYYY-MM-DD` |
| `date-time` | RFC3339 |
| `time` | `HH:MM:SS` |
| `uri` | Must contain `://` |
| `uuid` | UUID regex match |
| `ipv4` | 4 segments, each 0–255 |
| `ipv6` | Parses via `net.ParseIP` and contains `:` |

## The ValidationError Type

Each constraint violation is a `ValidationError` carrying the offending JSON path and a description:

```go
type ValidationError struct {
    Path    string `json:"path"`    // Error path (e.g. "user.email", "tags[1]")
    Message string `json:"message"` // Error message
}

func (ve *ValidationError) Error() string
```

Since `ValidateSchema` returns a `[]ValidationError` slice, iterate it and read `Path` / `Message`; the `Error()` method formats a single error as a string (e.g. for logging).

## Creating a Schema

There are three ways to construct a `Schema`; **the key difference is whether length/range constraints take effect**:

```go
// 1) Direct literal: Type/Required/Properties/Items/Pattern/Format/Enum/Const/
//    UniqueItems/MultipleOf work immediately; but MinLength/MaxLength/Minimum/Maximum/
//    MinItems/MaxItems/ExclusiveMinimum/ExclusiveMaximum do not (see note below)
schema := &json.Schema{Type: "string", Pattern: `^\d+$`}

// 2) NewSchema: set constraints via SchemaConfig pointer fields; all
//    length/range constraints work
cfg := json.DefaultSchemaConfig()
cfg.Type = "string"
minLen := 1
cfg.MinLength = &minLen
schema := json.NewSchema(cfg)

// 3) DefaultSchema: returns a Schema with default values (AdditionalProperties true)
schema := json.DefaultSchema()
```

::: warning Length/range constraints require NewSchema
`MinLength`, `MaxLength`, `Minimum`, `Maximum`, `MinItems`, `MaxItems`, `ExclusiveMinimum`, and `ExclusiveMaximum` rely on tracking flags inside `Schema` that cannot be set externally. Assigning these fields directly in an `&json.Schema{...}` literal **has no effect**. There is exactly one way to enable them: use `NewSchema` (or its deprecated alias `NewSchemaWithConfig`) and pass the constraint as the corresponding **pointer field** (e.g. `cfg.MinLength = &v`).

`Type`, `Required`, `Properties`, `Items`, `Pattern`, `Format`, `Enum`, `Const`, `UniqueItems`, and `MultipleOf` are exempt: both literals and `NewSchema` handle them.
:::

### NewSchema

Signature: `func NewSchema(cfg SchemaConfig) *Schema`

`NewSchema` is the **canonical constructor** for a configured Schema, named like every other `New*(cfg)` constructor in the library. It does three things: enables length/range constraints from the `SchemaConfig` pointer fields, initializes `Properties` / `Required`, and applies the `AdditionalProperties` default.

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "string"
minLen := 1
cfg.MinLength = &minLen
schema := json.NewSchema(cfg)
```

### NewSchemaWithConfig

<Badge type="danger" text="Deprecated" />

Signature: `func NewSchemaWithConfig(cfg SchemaConfig) *Schema`

A deprecated alias with the same signature as `NewSchema`.

::: warning Deprecated
`NewSchemaWithConfig` is fully equivalent to [`NewSchema`](#newschema) — it delegates to the same implementation. The "WithConfig" suffix predates the unified Config convention; no other constructor carries it. Use `NewSchema(cfg)` in new code; `NewSchemaWithConfig` will not be removed within v1.
:::

```go
// Fully equivalent to json.NewSchema(cfg)
schema := json.NewSchemaWithConfig(cfg)
```

### DefaultSchema

Signature: `func DefaultSchema() *Schema`

`DefaultSchema` returns a Schema with default values: `Properties` initialized to an empty map, `Required` to an empty slice, and `AdditionalProperties` to `true` (extra properties allowed) — a good starting point to fill in incrementally.

### DefaultSchemaConfig

Signature: `func DefaultSchemaConfig() SchemaConfig`

`DefaultSchemaConfig` returns the default input for `NewSchema`: only `AdditionalProperties` is preset to a pointer to `true`; every other field is the zero value. Set `Type` and the pointer fields on it, then create the Schema.

The two produce consistent results: `DefaultSchema()` equals `NewSchema(DefaultSchemaConfig())` — both allow extra properties by default.

### SchemaConfig Fields

The fields of `SchemaConfig` correspond one-to-one with `Schema`, and the numeric/boolean constraints are **pointer types**: `nil` means the constraint is unset, and `NewSchema` enables it only when a non-`nil` pointer is passed. That is exactly why length/range constraints must go through `NewSchema`; see the [warning above](#creating-a-schema).

| Field                  | Type                 | Description                                                                          |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `Type`                  | `string`             | JSON type (same as `Schema.Type`)                                                     |
| `Properties`            | `map[string]*Schema` | Sub-schema for each property (initialized to an empty map when nil)                   |
| `Items`                 | `*Schema`            | Sub-schema for array elements                                                         |
| `Required`              | `[]string`           | List of property names that must be present (initialized to an empty slice when nil)  |
| `MinLength`             | `*int`               | Minimum length (nil = unset)                                                          |
| `MaxLength`             | `*int`               | Maximum length (nil = unset)                                                          |
| `Minimum`               | `*float64`           | Minimum value (nil = unset)                                                           |
| `Maximum`               | `*float64`           | Maximum value (nil = unset)                                                           |
| `Pattern`               | `string`             | Regular expression                                                                    |
| `Format`                | `string`             | Semantic format                                                                       |
| `AdditionalProperties`  | `*bool`              | Whether extra properties are allowed (nil treated as `true`; `DefaultSchemaConfig` presets a pointer to `true`) |
| `MinItems`              | `*int`               | Minimum element count (nil = unset)                                                   |
| `MaxItems`              | `*int`               | Maximum element count (nil = unset)                                                   |
| `UniqueItems`           | `bool`               | Requires elements to be unique                                                        |
| `Enum`                  | `[]any`              | List of allowed enum values                                                           |
| `Const`                 | `any`                | Fixed value that must be matched                                                      |
| `MultipleOf`            | `*float64`           | Multiple-of constraint (nil = unset)                                                  |
| `ExclusiveMinimum`      | `*bool`              | Excludes the lower boundary (nil = unset)                                             |
| `ExclusiveMaximum`      | `*bool`              | Excludes the upper boundary (nil = unset)                                             |
| `Title`                 | `string`             | Title (metadata)                                                                      |
| `Description`           | `string`             | Description (metadata)                                                                |
| `Default`               | `any`                | Default value (metadata)                                                              |
| `Examples`              | `[]any`              | Example values (metadata)                                                             |

Always create configured schemas with `NewSchema` (`func NewSchema(cfg SchemaConfig) *Schema`): it is the only way to enable pointer constraints, and it initializes `Properties` / `Required` automatically and applies the `AdditionalProperties` default.

## Validation-Related Config Fields

| Field | Type | Description |
|-------|------|-------------|
| `EnableValidation` | `bool` | Deprecated: not read by any operation (validation always runs by default unless `SkipValidation`); only takes part in the config cache key |
| `ValidateInput` | `bool` | Deprecated: not read by any operation; setting it changes nothing |
| `SkipValidation` | `bool` | Skips non-essential validation (trusted input only) |

::: warning Deprecated extension fields
`Config.CustomValidators` (`[]Validator`) and the `Validator` interface are **deprecated** (marked Deprecated in the source): the field is declared and takes part in config cloning and cache-key computation, but validators are **never executed by any public operation**. Registering validators via `Config.CustomValidators` (or `Config.AddValidator`) changes no operation's behavior, and no operation is rejected because of a custom validator. Both are kept within v1:

```go
// Deprecated: declared but never executed; registering has no effect
type Validator interface {
    Validate(jsonStr string) error
}
```

For custom validation before/after operations, use the effective [Hooks](../extensions/hooks) (e.g. `ValidationHook`).
:::

## See Also

- [Interface Definitions](./interfaces): the (deprecated) `Validator` interface and `Schema`-related types
- [Type Definitions](./types): core types (`Config` / `Schema` / `Stats` / `AccessResult`)
- [Parse & Validate](./functions/parse): `Parse` / `Valid` / `ValidateSchema` functions
- [Config](./config): validation-related configuration fields
- [Hooks](../extensions/hooks): the effective pre/post interception mechanism (incl. `ValidationHook`)
