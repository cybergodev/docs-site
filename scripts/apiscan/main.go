// Command apiscan extracts the exported API surface of a Go module — exported
// functions, methods, types, constants and variables, each with its signature
// and doc comment — into a JSON manifest. The manifest is consumed by
// scripts/audit-api.ts to detect drift between the source code and the
// hand-written API-reference docs.
//
// It parses the AST only (go/parser + go/doc): no type checking, no build of
// the scanned project, so it needs none of the target's module dependencies.
//
// Filters:
//   - skip files: *_test.go, *.pb.go, *.gen.go
//   - skip dirs:  internal, testdata, vendor, examples, example, dev_test,
//                 docs, node_modules, .git, .idea, .claude
//   - only exported (uppercase) identifiers (go/doc default)
//   - skip Test*/Benchmark*/Example*/Fuzz* names
//   - mark `// Deprecated:` (kept, flagged, not dropped)
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"go/ast"
	"go/doc"
	"go/parser"
	"go/printer"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Symbol is one exported callable / value.
type Symbol struct {
	Name       string `json:"name"`
	Signature  string `json:"signature,omitempty"`
	Doc        string `json:"doc,omitempty"`
	Deprecated bool   `json:"deprecated,omitempty"`
}

// Type is one exported type with its methods and (for structs) fields.
type Type struct {
	Name       string   `json:"name"`
	Kind       string   `json:"kind"`
	Signature  string   `json:"signature,omitempty"`
	Doc        string   `json:"doc,omitempty"`
	Deprecated bool     `json:"deprecated,omitempty"`
	Methods    []Symbol `json:"methods,omitempty"`
	Fields     []Symbol `json:"fields,omitempty"`
}

// Package holds the exported surface of one Go package.
type Package struct {
	Path      string   `json:"path"`
	Dir       string   `json:"dir"`
	Doc       string   `json:"doc,omitempty"`
	Types     []Type   `json:"types,omitempty"`
	Functions []Symbol `json:"functions,omitempty"`
	Constants []Symbol `json:"constants,omitempty"`
	Variables []Symbol `json:"variables,omitempty"`
}

// Manifest is the top-level JSON shape: one module → many packages.
type Manifest struct {
	Module   string    `json:"module"`
	Packages []Package `json:"packages"`
}

// Directories never scanned (test scaffolding, internals, vendoring, tooling).
var skipDirs = map[string]bool{
	"internal": true, "testdata": true, "vendor": true,
	"examples": true, "example": true, "dev_test": true,
	"docs": true, "node_modules": true, ".git": true, ".idea": true, ".claude": true,
}

func isExcludedFile(name string) bool {
	return strings.HasSuffix(name, "_test.go") ||
		strings.HasSuffix(name, ".pb.go") ||
		strings.HasSuffix(name, ".gen.go")
}

// aliasTarget describes the destination of a qualified type alias
// declaration `type X = pkg.Y`. The same-package form (`type X = Y`, an
// *ast.Ident) is intentionally not handled — it has no cross-package
// visibility problem because the source AST sees the methods directly.
type aliasTarget struct {
	importPath string // full import path of the target package, e.g. "github.com/cybergodev/env/internal"
	typeName   string // exported type name in that package, e.g. "CloseableChannelHandler"
}

// lookupImport resolves a package qualifier (the token before `.` in a
// selector like `internal.Foo`) to its full import path, scanning every file
// in the package for a matching import spec. Returns "" if not found (the
// qualifier refers to a stdlib / third-party package, or to a dot/blank
// import — none of which we can resolve to an in-module dir).
func lookupImport(pkgAST *ast.Package, qual string) string {
	for _, f := range pkgAST.Files {
		for _, imp := range f.Imports {
			path := strings.Trim(imp.Path.Value, `"`)
			var name string
			if imp.Name != nil {
				name = imp.Name.Name // explicit alias: `ierrors "...internal"`
			} else {
				if i := strings.LastIndex(path, "/"); i >= 0 {
					name = path[i+1:]
				} else {
					name = path
				}
			}
			if name == "." || name == "_" || name != qual {
				continue
			}
			return path
		}
	}
	return ""
}

// extractAliasTarget inspects a type-alias declaration's AST and, if it is a
// qualified in-module reference (`type X = pkg.Y`), resolves `pkg.Y` to
// {importPath, typeName}. Returns nil for non-qualified aliases
// (`type X = int`), external-package targets, or anything we cannot resolve.
func extractAliasTarget(t *doc.Type, pkgAST *ast.Package) *aliasTarget {
	if t.Decl == nil {
		return nil
	}
	for _, sp := range t.Decl.Specs {
		ts, ok := sp.(*ast.TypeSpec)
		if !ok {
			continue
		}
		sel, ok := ts.Type.(*ast.SelectorExpr)
		if !ok {
			continue
		}
		pkgIdent, ok := sel.X.(*ast.Ident)
		if !ok {
			continue
		}
		path := lookupImport(pkgAST, pkgIdent.Name)
		if path == "" {
			continue
		}
		return &aliasTarget{importPath: path, typeName: sel.Sel.Name}
	}
	return nil
}

// targetDir converts an in-module import path to its source directory (relative
// to src). Returns "" for import paths outside the current module — those
// targets can't be resolved by reading the local source tree.
func targetDir(module, importPath string) string {
	if importPath == module {
		return "."
	}
	prefix := module + "/"
	if !strings.HasPrefix(importPath, prefix) {
		return ""
	}
	return strings.TrimPrefix(importPath, prefix)
}

// aliasResolver parses skipped packages (typically internal/) on demand to
// discover the exported methods of types reached only via a public alias.
// Without it, `type X = internal.Y` looks like a method-less alias even when Y
// has methods — the canonical case is env's `CloseableChannelHandler` whose
// `Channel()` method lives on the internal struct. One parser instance is
// reused across the whole scan so each target dir is parsed at most once.
type aliasResolver struct {
	src    string
	module string
	fset   *token.FileSet
	cache  map[string]*doc.Package
}

func newAliasResolver(src, module string) *aliasResolver {
	return &aliasResolver{src: src, module: module, fset: token.NewFileSet(), cache: make(map[string]*doc.Package)}
}

// parseTarget parses the target package on demand (the main scan skips
// internal/, so these are usually not yet parsed) and caches it. Returns nil
// for external packages or unreadable dirs (skip gracefully).
func (r *aliasResolver) parseTarget(importPath string) *doc.Package {
	if dp, ok := r.cache[importPath]; ok {
		return dp
	}
	rel := targetDir(r.module, importPath)
	if rel == "" {
		r.cache[importPath] = nil
		return nil
	}
	dir := filepath.Join(r.src, rel)
	pkgs, err := parser.ParseDir(r.fset, dir, func(fi fs.FileInfo) bool {
		return !isExcludedFile(fi.Name())
	}, parser.ParseComments)
	if err != nil || len(pkgs) == 0 {
		r.cache[importPath] = nil
		return nil
	}
	var pkgAST *ast.Package
	for name, p := range pkgs {
		if strings.HasSuffix(name, "_test") {
			continue
		}
		pkgAST = p
		break
	}
	if pkgAST == nil {
		r.cache[importPath] = nil
		return nil
	}
	dp := doc.New(pkgAST, importPath, 0)
	r.cache[importPath] = dp
	return dp
}

// targetTypeMethods returns the exported methods of {importPath}.typeName,
// renamed to aliasName.Method so the existing audit-api collectSymbols logic
// picks up both "AliasName.Method" and the bare "Method" identifier. Covers
// receiver methods (structs) and inline interface method declarations — the
// two surfaces the public alias actually exposes. Returns nil if the target
// package or type can't be resolved.
func (r *aliasResolver) targetTypeMethods(importPath, typeName, aliasName string) []Symbol {
	dp := r.parseTarget(importPath)
	if dp == nil {
		return nil
	}
	for _, t := range dp.Types {
		if t.Name != typeName {
			continue
		}
		var out []Symbol
		for _, m := range t.Methods {
			name := m.Decl.Name.Name
			if isTestFuncName(name) {
				continue
			}
			out = append(out, Symbol{
				Name:       aliasName + "." + name,
				Signature:  funcSig(r.fset, m.Decl),
				Doc:        trimDoc(m.Doc),
				Deprecated: isDeprecated(m.Doc),
			})
		}
		// Interface method set: same dual source as the main scan — go/doc's
		// t.Methods holds only receiver methods, so the interface's inline
		// declarations are read from the AST and the prefix renamed.
		for _, sm := range interfaceMethods(r.fset, t) {
			methodName := strings.TrimPrefix(sm.Name, typeName+".")
			out = append(out, Symbol{
				Name:       aliasName + "." + methodName,
				Signature:  sm.Signature,
				Doc:        sm.Doc,
				Deprecated: sm.Deprecated,
			})
		}
		return out
	}
	return nil
}

// isTestFuncName drops Go test funcs (TestXxx/BenchmarkXxx/ExampleXxx/FuzzXxx,
// where Xxx starts uppercase — the Go test convention). The uppercase check
// avoids clobbering exported helpers whose names merely begin with these
// prefixes, e.g. TestingConfig / TestingClient. (*_test.go is already excluded;
// this is a defensive guard for any test-funcs living outside it.)
func isTestFuncName(name string) bool {
	for _, p := range []string{"Test", "Benchmark", "Example", "Fuzz"} {
		if strings.HasPrefix(name, p) {
			rest := name[len(p):]
			return rest != "" && rest[0] >= 'A' && rest[0] <= 'Z'
		}
	}
	return false
}

func isDeprecated(doc string) bool { return strings.Contains(doc, "Deprecated:") }

// trimDoc collapses a doc comment to a single trimmed line (enough to identify
// a symbol; the full text stays in source).
func trimDoc(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, "\n"); i >= 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}

// Collect every directory under root that contains at least one non-excluded
// .go file (= one Go package), skipping skipDirs.
func collectPkgDirs(root string) []string {
	var dirs []string
	seen := map[string]bool{}
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() {
			return nil
		}
		if path != root && skipDirs[d.Name()] {
			return filepath.SkipDir
		}
		entries, e := os.ReadDir(path)
		if e != nil {
			return nil
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			if strings.HasSuffix(e.Name(), ".go") && !isExcludedFile(e.Name()) {
				if !seen[path] {
					seen[path] = true
					dirs = append(dirs, path)
				}
				break
			}
		}
		return nil
	})
	return dirs
}

func main() {
	src := flag.String("src", "", "path to the Go module root to scan")
	module := flag.String("module", "", "module path (e.g. github.com/cybergodev/json)")
	out := flag.String("out", "", "output JSON file (empty = stdout)")
	flag.Parse()
	if *src == "" || *module == "" {
		fmt.Fprintln(os.Stderr, "usage: apiscan -src <dir> -module <path> [-out <file>]")
		os.Exit(2)
	}

	fset := token.NewFileSet()
	manifest := Manifest{Module: *module}
	resolver := newAliasResolver(*src, *module)

	for _, dir := range collectPkgDirs(*src) {
		// parser.ParseDir is deprecated upstream (it ignores build tags); the
		// suggested golang.org/x/tools/go/packages would add an external dep.
		// We keep ParseDir to stay stdlib-only — build-tag precision is
		// irrelevant for extracting the exported API surface.
		pkgs, err := parser.ParseDir(fset, dir, func(fi fs.FileInfo) bool {
			return !isExcludedFile(fi.Name())
		}, parser.ParseComments)
		if err != nil {
			fmt.Fprintf(os.Stderr, "apiscan: parse %s: %v\n", dir, err)
			continue
		}
		for _, pkgAST := range pkgs {
			rel, _ := filepath.Rel(*src, dir)
			rel = filepath.ToSlash(rel)
			importPath := *module
			if rel != "." {
				importPath = *module + "/" + rel
			}
			dpkg := doc.New(pkgAST, importPath, 0)
			pkgOut := Package{Path: importPath, Dir: rel, Doc: trimDoc(dpkg.Doc)}

			for _, f := range dpkg.Funcs {
				if isTestFuncName(f.Name) {
					continue
				}
				pkgOut.Functions = append(pkgOut.Functions, Symbol{
					Name: f.Name, Signature: funcSig(fset, f.Decl),
					Doc: trimDoc(f.Doc), Deprecated: isDeprecated(f.Doc),
				})
			}

			for _, t := range dpkg.Types {
				ty := Type{
					Name: t.Name, Kind: typeKind(t), Signature: typeSig(fset, t),
					Doc: trimDoc(t.Doc), Deprecated: isDeprecated(t.Doc),
				}
				if ty.Kind == "struct" {
					ty.Fields = structFields(fset, t)
				}
				for _, m := range t.Methods {
					name := m.Decl.Name.Name
					if isTestFuncName(name) {
						continue
					}
					ty.Methods = append(ty.Methods, Symbol{
						Name: t.Name + "." + name, Signature: funcSig(fset, m.Decl),
						Doc: trimDoc(m.Doc), Deprecated: isDeprecated(m.Doc),
					})
				}
				// Interface method set: go/doc's t.Methods holds only receiver
				// methods (func (T) M()), NOT the methods declared inside
				// `interface { … }`. Without collecting those, every interface-
				// method doc reference (Reader.Read, Logger.Log, …) false-positives
				// as dangling. Structs have no such set — only interfaces do.
				if ty.Kind == "interface" {
					ty.Methods = append(ty.Methods, interfaceMethods(fset, t)...)
				}
				// Qualified type alias (`type X = pkg.Y`): attach the target
				// type's exported methods as X.Method. The target is usually
				// inside internal/ (skipped by the main scan), so the resolver
				// parses it on demand. Without this, a doc reference like
				// `handler.Channel()` — where Channel is defined on the
				// internal struct reached only via the public alias — would
				// false-positive as DANGLING. Non-qualified / external aliases
				// fall through (extractAliasTarget returns nil).
				if ty.Kind == "alias" {
					if at := extractAliasTarget(t, pkgAST); at != nil {
						ty.Methods = append(ty.Methods, resolver.targetTypeMethods(
							at.importPath, at.typeName, ty.Name)...)
					}
				}
				pkgOut.Types = append(pkgOut.Types, ty)

				// go/doc ASSOCIATES declarations with their type and moves them
				// out of the package-level lists: factory funcs (func NewEncoder()
				// *Encoder) land in t.Funcs, typed vars/consts (var DefaultConfig
				// Config) in t.Vars / t.Consts. Collect them here or they'd be
				// silently dropped and every reference false-positive as dangling.
				for _, f := range t.Funcs {
					name := f.Decl.Name.Name
					if isTestFuncName(name) {
						continue
					}
					pkgOut.Functions = append(pkgOut.Functions, Symbol{
						Name: name, Signature: funcSig(fset, f.Decl),
						Doc: trimDoc(f.Doc), Deprecated: isDeprecated(f.Doc),
					})
				}
				for _, c := range t.Consts {
					pkgOut.Constants = append(pkgOut.Constants, valSymbols(c)...)
				}
				for _, v := range t.Vars {
					pkgOut.Variables = append(pkgOut.Variables, valSymbols(v)...)
				}
			}

			for _, c := range dpkg.Consts {
				pkgOut.Constants = append(pkgOut.Constants, valSymbols(c)...)
			}
			for _, v := range dpkg.Vars {
				pkgOut.Variables = append(pkgOut.Variables, valSymbols(v)...)
			}

			manifest.Packages = append(manifest.Packages, pkgOut)
		}
	}

	buf, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "apiscan: marshal: %v\n", err)
		os.Exit(1)
	}
	buf = append(buf, '\n')

	if *out == "" {
		os.Stdout.Write(buf)
		return
	}
	if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "apiscan: mkdir: %v\n", err)
		os.Exit(1)
	}
	if err := os.WriteFile(*out, buf, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "apiscan: write: %v\n", err)
		os.Exit(1)
	}
	total := 0
	for _, p := range manifest.Packages {
		total += len(p.Functions) + len(p.Types) + len(p.Constants) + len(p.Variables)
	}
	fmt.Fprintf(os.Stderr, "apiscan: %s → %d packages, %d symbols → %s\n", *module, len(manifest.Packages), total, *out)
}

// funcSig prints a FuncDecl's signature (receiver + name + params + results),
// with the body elided and whitespace collapsed to one line.
func funcSig(fset *token.FileSet, fn *ast.FuncDecl) string {
	if fn == nil {
		return ""
	}
	clone := *fn
	clone.Body = nil
	var b strings.Builder
	if err := printer.Fprint(&b, fset, &clone); err != nil {
		return ""
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

// typeSig prints a type declaration line (e.g. "type Processor struct { ... }"),
// eliding the body for struct/interface to keep it compact.
func typeSig(fset *token.FileSet, t *doc.Type) string {
	if t.Decl == nil {
		return ""
	}
	for _, sp := range t.Decl.Specs {
		ts, ok := sp.(*ast.TypeSpec)
		if !ok {
			continue
		}
		// Elide struct/interface bodies (they can be huge); keep everything else.
		if _, isStruct := ts.Type.(*ast.StructType); isStruct {
			return fmt.Sprintf("type %s struct { ... }", ts.Name.Name)
		}
		if _, isIface := ts.Type.(*ast.InterfaceType); isIface {
			return fmt.Sprintf("type %s interface { ... }", ts.Name.Name)
		}
		clone := *ts
		var b strings.Builder
		if err := printer.Fprint(&b, fset, &clone); err != nil {
			return ""
		}
		return "type " + strings.Join(strings.Fields(b.String()), " ")
	}
	return ""
}

// structFields returns the exported fields of a struct type (incl. embedded
// exported types), each as a Symbol with its type signature. Fields are part
// of the public API — users set Config fields directly — so they must be
// collected or every field reference would false-positive as "dangling".
func structFields(fset *token.FileSet, t *doc.Type) []Symbol {
	if t.Decl == nil {
		return nil
	}
	var out []Symbol
	for _, sp := range t.Decl.Specs {
		ts, ok := sp.(*ast.TypeSpec)
		if !ok {
			continue
		}
		st, ok := ts.Type.(*ast.StructType)
		if !ok || st.Fields == nil {
			continue
		}
		for _, field := range st.Fields.List {
			typ := exprString(fset, field.Type)
			if len(field.Names) == 0 {
				// Embedded field: name is the type name (strip package qualifier).
				name := typ
				if i := strings.LastIndex(name, "."); i >= 0 {
					name = name[i+1:]
				}
				if token.IsExported(name) {
					out = append(out, Symbol{Name: name, Signature: name})
				}
				continue
			}
			for _, n := range field.Names {
				if token.IsExported(n.Name) {
					out = append(out, Symbol{
						Name: n.Name, Signature: n.Name + " " + typ,
						Doc: trimDoc(field.Doc.Text()),
					})
				}
			}
		}
	}
	return out
}

// interfaceMethods returns the method names declared inside an interface type
// (inline method declarations only — embedded interfaces are skipped, their
// methods belong to the embedded type). go/doc's Type.Methods holds only
// receiver methods, so the interface method set must be read from the AST
// directly. Function declaration order is irrelevant in Go, so this may call
// exprString (defined below).
func interfaceMethods(fset *token.FileSet, t *doc.Type) []Symbol {
	if t.Decl == nil {
		return nil
	}
	var out []Symbol
	for _, sp := range t.Decl.Specs {
		ts, ok := sp.(*ast.TypeSpec)
		if !ok {
			continue
		}
		it, ok := ts.Type.(*ast.InterfaceType)
		if !ok || it.Methods == nil {
			continue
		}
		for _, field := range it.Methods.List {
			if len(field.Names) == 0 {
				continue // embedded interface (e.g. io.Reader) — skip
			}
			for _, n := range field.Names {
				if token.IsExported(n.Name) {
					out = append(out, Symbol{
						Name:      t.Name + "." + n.Name,
						Signature: exprString(fset, field.Type),
					})
				}
			}
		}
	}
	return out
}

// exprString prints an ast.Expr to a compact one-line string.
func exprString(fset *token.FileSet, e ast.Expr) string {
	var b strings.Builder
	if err := printer.Fprint(&b, fset, e); err != nil {
		return ""
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

// typeKind returns struct / interface / func / type-alias.
func typeKind(t *doc.Type) string {
	if t.Decl == nil {
		return ""
	}
	for _, sp := range t.Decl.Specs {
		ts, ok := sp.(*ast.TypeSpec)
		if !ok {
			continue
		}
		switch ts.Type.(type) {
		case *ast.StructType:
			return "struct"
		case *ast.InterfaceType:
			return "interface"
		case *ast.FuncType:
			return "func"
		default:
			return "alias"
		}
	}
	return ""
}

// valSymbols expands a doc.Value (const/var, possibly multiple names in one
// declaration) into one Symbol per name.
func valSymbols(v *doc.Value) []Symbol {
	var out []Symbol
	for _, n := range v.Names {
		n = strings.TrimSpace(n)
		if n == "" {
			continue
		}
		out = append(out, Symbol{
			Name: n, Doc: trimDoc(v.Doc), Deprecated: isDeprecated(v.Doc),
		})
	}
	return out
}
