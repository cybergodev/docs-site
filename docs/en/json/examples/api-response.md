---
sidebar_label: "API Response Parsing"
title: "API Response Parsing - CyberGo JSON | Pagination & Structs"
description: "CyberGo JSON API responses: ParseAny, GetString/GetInt metadata, Get/GetArray nested data, path slices for pagination, GetTyped structs, ForeachWithPath."
sidebar_position: 30
---

# API Response Parsing

HTTP API JSON responses usually raise three needs: reading status and pagination metadata, slicing arrays by path, and deserializing into structs. The examples below cover all three and state when each API fits.

## Parsing a Paginated API Response

Simulate a paginated REST API response, extract the status field and pagination metadata, take a subset with the path slice `items[0:2]`, then extract fields element by element.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// Simulated paginated API response
	apiResponse := `{
        "status": "success",
        "data": {
            "page": 2,
            "per_page": 5,
            "total": 48,
            "items": [
                {"id": 6, "name": "project-six", "stars": 120},
                {"id": 7, "name": "project-seven", "stars": 89},
                {"id": 8, "name": "project-eight", "stars": 245},
                {"id": 9, "name": "project-nine", "stars": 56},
                {"id": 10, "name": "project-ten", "stars": 312}
            ]
        }
    }`

	// 1. Extract response status and pagination metadata
	status := json.GetString(apiResponse, "status")
	page := json.GetInt(apiResponse, "data.page")
	total := json.GetInt(apiResponse, "data.total")
	fmt.Printf("Status: %s, page %d, %d items in total\n", status, page, total)

	// 2. Get the whole data array
	items := json.GetArray(apiResponse, "data.items")
	fmt.Printf("Items in this response: %d\n", len(items))

	// 3. Take a subset with a path slice (the first 2)
	firstTwo, err := json.Get(apiResponse, "data.items[0:2]")
	if err != nil {
		panic(err)
	}
	fmt.Printf("First two: %v\n", firstTwo)

	// 4. Iterate the array and extract each element's fields
	// (ForeachWithPath: one parse, per-element field access)
	err = json.ForeachWithPath(apiResponse, "data.items", func(key any, item *json.IterableValue) {
		fmt.Printf("  - %s (%d stars)\n", item.GetString("name"), item.GetInt("stars"))
	})
	if err != nil {
		panic(err)
	}
}

// Output:
// Status: success, page 2, 48 items in total
// Items in this response: 5
// First two: [map[id:6 name:project-six stars:120] map[id:7 name:project-seven stars:89]]
//   - project-six (120 stars)
//   - project-seven (89 stars)
//   - project-eight (245 stars)
//   - project-nine (56 stars)
//   - project-ten (312 stars)
```

:::tip
The path slice syntax `[start:end]` returns an array subset; you can also use `[start:end:step]` for stepped slices, `[-1]` for the last element, and `[*]` to walk all elements. Full syntax in [Path Expressions](../getting-started/path-syntax).

When iterating arrays, use `ForeachWithPath` instead of looping over composed paths (querying `fmt.Sprintf("data.items.%d.name", i)` one by one): the former parses once and reads fields by name inside each element; the latter issues a separate query per path.
:::

## Fetching Multiple Fields at Once

When a response has many fields to extract, `GetMultiple` parses once and retrieves all paths (the result map is keyed by path):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	apiResponse := `{
        "status": "success",
        "data": {
            "page": 2,
            "per_page": 5,
            "total": 48,
            "items": [
                {"id": 6, "name": "project-six", "stars": 120},
                {"id": 7, "name": "project-seven", "stars": 89}
            ]
        }
    }`

	values, err := json.GetMultiple(apiResponse, []string{
		"status",
		"data.page",
		"data.per_page",
		"data.total",
		"data.items.0.name",
	})
	if err != nil {
		panic(err)
	}

	fmt.Printf("%s | page %v/%v, %v items in total, first: %v\n",
		values["status"], values["data.page"], values["data.per_page"],
		values["data.total"], values["data.items.0.name"])
}

// Output: success | page 2/5, 48 items in total, first: project-six
```

:::tip Note
If any path fails (missing or invalid), `GetMultiple` returns the **first** error, and that path is `nil` in the result map. It therefore suits responses where fields definitely exist; for optional fields, use `GetString(apiResponse, "path", "default")` with a default, or the `SafeGet` below.
:::

## Safe Access with SafeGet

`SafeGet` returns an `AccessResult` instead of an error: `Ok()` checks existence, `AsInt`/`AsString` convert on demand, and `UnwrapOr` supplies a default. It fits third-party responses with unstable or optional field types, and no call panics:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	apiResponse := `{
        "status": 200,
        "message": "ok",
        "retry_after": "30",
        "trace_id": "abc-123"
    }`

	// status is a number (JSON numbers parse as float64); the Type field
	// reports the runtime type
	status := json.SafeGet(apiResponse, "status")
	fmt.Println("status type:", status.Type)
	if code, err := status.AsInt(); err == nil {
		fmt.Println("Status code:", code)
	}

	// retry_after is a number of seconds in string form
	retry := json.SafeGet(apiResponse, "retry_after")
	if secs, err := retry.AsString(); err == nil {
		fmt.Println("Retry after (seconds):", secs)
	}

	// Missing path: Ok() is false, UnwrapOr provides the fallback
	deprecated := json.SafeGet(apiResponse, "deprecated_field")
	fmt.Println("Deprecated field exists:", deprecated.Ok())
	fmt.Println("Deprecated field fallback:", deprecated.UnwrapOr("none"))
}

// Output:
// status type: float64
// Status code: 200
// Retry after (seconds): 30
// Deprecated field exists: false
// Deprecated field fallback: none
```

When strict conversion fails, the `As*` methods return an error rather than a silent zero value, avoiding confusing "field missing" with "value is 0"; for lenient conversion (any type to its string form), use `AsStringConverted`.

## Deserializing into Structs

Use `GetTyped[T]` to deserialize the whole response or any nested sub-object into a strongly typed struct; use `ParseAny` to get an `any` value (suited to unknown structures).

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

// Repository represents a repo entry in the API response
type Repository struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Stars int    `json:"stars"`
}

// APIResponse represents the whole API response
type APIResponse struct {
	Status string `json:"status"`
	Data   struct {
		Page  int          `json:"page"`
		Total int          `json:"total"`
		Items []Repository `json:"items"`
	} `json:"data"`
}

func main() {
	apiResponse := `{
        "status": "success",
        "data": {
            "page": 1,
            "total": 3,
            "items": [
                {"id": 1, "name": "cybergo-json", "stars": 500},
                {"id": 2, "name": "cybergo-jwt", "stars": 320},
                {"id": 3, "name": "cybergo-httpc", "stars": 280}
            ]
        }
    }`

	// 1. Deserialize the whole response into a struct (path "." is the root object)
	resp := json.GetTyped[APIResponse](apiResponse, ".")
	fmt.Printf("Status: %s, %d repos in total\n", resp.Status, resp.Data.Total)
	for _, repo := range resp.Data.Items {
		fmt.Printf("  #%d %s (%d stars)\n", repo.ID, repo.Name, repo.Stars)
	}

	// 2. GetTyped on a single nested object (decode a sub-object into a struct)
	firstRepo := json.GetTyped[Repository](apiResponse, "data.items.0")
	fmt.Printf("First repo: %+v\n", firstRepo)

	// 3. Use ParseAny for an arbitrary value (for unknown response structures)
	parsed, err := json.ParseAny(apiResponse)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Parsed type: %T\n", parsed)
}

// Output:
// Status: success, 3 repos in total
//   #1 cybergo-json (500 stars)
//   #2 cybergo-jwt (320 stars)
//   #3 cybergo-httpc (280 stars)
// First repo: {ID:1 Name:cybergo-json Stars:500}
// Parsed type: map[string]interface {}
```

## Next Steps

- [Basic Examples](./index) — path queries and struct encoding/decoding basics
- [Advanced Examples](./examples-advanced) — SafeGet, batch operations, and more
- [Cheat Sheet](../getting-started/cheatsheet) — Quick API reference
- [Path Expression Syntax](../getting-started/path-syntax) — slices, wildcards, field extraction
