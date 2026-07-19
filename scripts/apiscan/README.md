# apiscan — Go API surface scanner

Extracts the **exported API surface** of a Go module into a JSON manifest, used
by `scripts/audit-api.ts` to detect drift between source code and the
hand-written API-reference docs.

Pure AST parsing (`go/parser` + `go/doc`) — no type checking, no build of the
scanned project, **zero external dependencies** (standard library only).

## Usage

```bash
# From the docs-site-dev repo root:
go run ./scripts/apiscan -src D:/MyProject/json-dev \
  -module github.com/cybergodev/json \
  -out report/api/json.json
```

Or via the TS orchestrator (scans all projects + writes the drift report):

```bash
npm run audit:api
```

## Filters ("公开 API 识别规则")

| What | Skipped how |
|------|-------------|
| `*_test.go`, `*.pb.go`, `*.gen.go` | filename suffix |
| `internal/`, `testdata/`, `vendor/`, `examples/`, `dev_test/`, `docs/` | dir name |
| unexported identifiers | `go/doc` default (exported only) |
| `Test*`/`Benchmark*`/`Example*`/`Fuzz*` | name prefix |
| `// Deprecated:` | kept in output, `deprecated: true` flag |

## Output shape

```json
{
  "module": "github.com/cybergodev/json",
  "packages": [
    {
      "path": "github.com/cybergodev/json",
      "dir": ".",
      "doc": "package json ...",
      "types": [
        {
          "name": "Processor", "kind": "struct",
          "signature": "type Processor struct { ... }",
          "methods": [
            { "name": "Processor.Set", "signature": "func (p *Processor) Set(path string, v any) error", "doc": "..." }
          ]
        }
      ],
      "functions": [
        { "name": "GetString", "signature": "func GetString(data []byte, path string) (string, error)", "doc": "..." }
      ],
      "constants": [ { "name": "DefaultConfig", "doc": "..." } ],
      "variables":  [ { "name": "ErrInvalid",  "doc": "..." } ]
    }
  ]
}
```

## Rebuilding / packaging

`go.mod` is a standalone module (`module apiscan`); run it in place with
`go run .` from this directory, or `go build -o apiscan` for a binary.
