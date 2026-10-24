---
sidebar_label: "Formatting Output"
title: "Formatting Output - CyberGo JSON | Pretty & Compact JSON"
description: "CyberGo JSON output formatting: Prettify, EncodePretty, MarshalIndent, Compact and HTMLEscape compared, with indentation and streaming examples."
sidebar_position: 30
---

# Formatting Output

::: tip Migration note
The Print / PrintPretty family of direct-print functions (Print, PrintE, PrintPretty, PrintPrettyE) was removed in an earlier release and is no longer provided; for migration details and replacements see [the historical note](#historical-note-the-removed-print-family).
:::

`Marshal`/`Encode` and the other encoders return compact JSON. For indentation, re-indenting, or compacting existing text, pick a function from the table below by input type.

## Formatting Tool Comparison

Choose a tool by whether the input is a Go value or JSON text:

| Function | Input | Output | Typical use |
|----------|-------|--------|-------------|
| `Marshal(v, cfg...)` | Go value | `[]byte` compact | Standard-library signature; most general |
| `Encode(v, cfg...)` | Go value | `string` compact | Recommended entry point (configurable) |
| `EncodePretty(v, cfg...)` | Go value | `string` indented | Encode and beautify in one step |
| `MarshalIndent(v, prefix, indent)` | Go value | `[]byte` indented | Standard-library signature; legacy-friendly |
| `Prettify(jsonStr, cfg...)` | JSON text | `string` indented | Beautify existing JSON text |
| `Compact(dst, src)` | JSON text | Writes to `*bytes.Buffer` | Compact existing text |
| `CompactString(jsonStr)` | JSON text | `string` compact | Compact existing text (no buffer) |
| `Indent(dst, src, prefix, indent)` | JSON text | Writes to `*bytes.Buffer` | Re-indent |
| `HTMLEscape(dst, src)` | JSON text | Writes to `*bytes.Buffer` | Escape `<` `>` `&` |
| `NewEncoder(w)` + `SetIndent` | Go value | Writes to `io.Writer` | Streaming output (files/network) |

::: tip Three-step selection
1. Input is a **Go value**: use `Marshal` for `[]byte`, `Encode` for `string`; switch to `MarshalIndent` / `EncodePretty` respectively when indentation is wanted
2. Input is already **JSON text**: beautify with `Prettify`, compact with `CompactString`; use the buffer forms `Compact`/`Indent` when the standard-library signature is required
3. Output goes to a **stream** (file/network): `NewEncoder` + `SetIndent` writes record by record, avoiding one giant string
:::

## Custom Indentation

`EncodePretty` indents two spaces by default. For other indentation use `Config.Pretty` + `Config.Indent`, or the standard-library signature `MarshalIndent`:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := map[string]any{"name": "Alice", "age": 30}

	// Option 1: standard-library MarshalIndent (prefix left empty)
	b, err := json.MarshalIndent(data, "", "    ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
	// Output:
	// {
	//     "age": 30,
	//     "name": "Alice"
	// }

	// Option 2: EncodePretty + configuration (tab indentation)
	cfg := json.DefaultConfig()
	cfg.Pretty = true
	cfg.Indent = "\t"
	s, err := json.EncodePretty(data, cfg)
	if err != nil {
		panic(err)
	}
	fmt.Println(s)
}
```

::: tip
`json.PrettyConfig()` is a ready-made preset: the default configuration + `Pretty: true` + two-space indentation — equivalent to `EncodePretty`'s default behavior.
:::

## Working with Existing JSON Text

When you already hold JSON text (logs, API responses), convert it in place with the formatting functions — no struct round-trip:

```go
package main

import (
	"bytes"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	pretty := "{\n  \"name\": \"Alice\",\n  \"age\": 30\n}"

	// Compact: remove all non-essential whitespace
	var compact bytes.Buffer
	if err := json.Compact(&compact, []byte(pretty)); err != nil {
		panic(err)
	}
	fmt.Println(compact.String())
	// Output: {"name":"Alice","age":30}

	// Buffer-free variant: CompactString returns a string directly
	s, err := json.CompactString(pretty)
	if err != nil {
		panic(err)
	}
	fmt.Println(s)

	// Re-indent: switch to another indentation style
	var reindented bytes.Buffer
	if err := json.Indent(&reindented, []byte(pretty), "", "\t"); err != nil {
		panic(err)
	}
	fmt.Println(reindented.String())
	// Output:
	// {
	// 	"name": "Alice",
	// 	"age": 30
	// }
}
```

## HTML-Safe Escaping

`HTMLEscape` matches the standard-library signature: it escapes `<`, `>`, `&`, U+2028, and U+2029 in JSON text into `\u00XX` form, preventing browsers from misparsing JSON embedded in HTML. It performs **character-level escaping** only — no re-encoding, no whitespace changes:

```go
package main

import (
	"bytes"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	src := []byte(`{"html":"<b>bold</b>","url":"a&b"}`)

	var buf bytes.Buffer
	json.HTMLEscape(&buf, src)
	out := buf.String()
	fmt.Println(out)
	// The output no longer contains bare <, >, & inside the quoted strings;
	// each is replaced by an escape sequence in \u00XX form, with the rest
	// of the content preserved as-is
}
```

::: tip When is manual escaping needed?
`Marshal`/`Encode` already enable HTML escaping by default (`Config.EscapeHTML: true`), so their output is inherently safe. `HTMLEscape` serves **JSON text obtained externally** — e.g. when embedding a third-party JSON response verbatim into an HTML page, run it through first.
:::

## Streaming Output to a Writer

When writing files or network streams, use `NewEncoder` (standard-library signature) instead of assembling one big string:

```go
package main

import (
	"os"

	"github.com/cybergodev/json"
)

func main() {
	type Item struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")

	for _, item := range []Item{{1, "Alice"}, {2, "Bob"}} {
		if err := enc.Encode(item); err != nil {
			panic(err)
		}
	}
	// Output:
	// {
	//   "id": 1,
	//   "name": "Alice"
	// }
	// {
	//   "id": 2,
	//   "name": "Bob"
	// }
}
```

`Encoder.Encode` behaves like the standard library, automatically appending a newline after each record — natural for emitting logs one by one or writing JSONL files.

## Complete Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"log"
)

func main() {
	data := map[string]any{
		"users": []any{
			map[string]any{"id": 1, "name": "Alice"},
			map[string]any{"id": 2, "name": "Bob"},
		},
		"total": 2,
	}

	// Compact output
	compact, err := json.Encode(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(compact)

	// Pretty output
	pretty, err := json.EncodePretty(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(pretty)
}
```

## Historical Note: The Removed Print Family

The four early direct-print functions Print, PrintPretty, PrintE, and PrintPrettyE have been removed from the library and are no longer provided. To format JSON, use [`Prettify`](../api-reference/index#formatting) or the standard-library-compatible `MarshalIndent`. Replacements for each scenario follow.

### Printing Compact JSON

Use `fmt.Println` + `Encode` (recommended) or `Marshal`:

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// Output: {"age":30,"name":"Alice"}

// Or use Marshal ([]byte output)
b, err := json.Marshal(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(b))
```

::: warning EncodeWithConfig is deprecated
`json.EncodeWithConfig` is marked deprecated (functionally identical to `Encode`) and will not be removed within v1. Use `Encode` or `Marshal` in new code.
:::

### Printing Pretty JSON

Use `fmt.Println` + `EncodePretty`:

```go
s, err := json.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// Output:
// {
//   "age": 30,
//   "name": "Alice"
// }
```

### Printing a JSON String (beautifying existing JSON)

Use `Prettify`:

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
// Output:
// {
//   "name": "Alice",
//   "age": 30
// }
```

### Printing with a Processor

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Encode and print (Encode recommended)
s, err := p.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// Pretty-print
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

## See Also

- [Encoding Output](../api-reference/functions/output) - Encode, EncodePretty, Prettify
- [Package Functions](../api-reference/functions/) - Package-level function overview
