import type { DefaultTheme } from 'vitepress'

export const enSidebars: Record<string, DefaultTheme.SidebarItem[]> = {
  '/en/json/': [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/json/' },
        { text: 'Quick Start', link: '/en/json/getting-started' },
        { text: 'Path Syntax', link: '/en/json/path-syntax' },
        { text: 'Cheat Sheet', link: '/en/json/cheatsheet' }
      ]
    },
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/json/api-reference/' },
        {
          text: 'Package Functions',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/en/json/api-reference/functions' },
            { text: 'Query & Get', link: '/en/json/api-reference/functions/get' },
            { text: 'Modify', link: '/en/json/api-reference/functions/modify' },
            { text: 'Encode & Decode', link: '/en/json/api-reference/functions/encode-decode' },
            { text: 'File I/O', link: '/en/json/api-reference/functions/file-io' }
          ]
        },
        {
          text: 'Processor',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/en/json/api-reference/processor/' },
            { text: 'Query', link: '/en/json/api-reference/processor/query' },
            { text: 'Modify', link: '/en/json/api-reference/processor/modify' },
            { text: 'Output', link: '/en/json/api-reference/processor/output' },
            { text: 'Parse & Load', link: '/en/json/api-reference/processor/parse' },
            { text: 'Iterate', link: '/en/json/api-reference/processor/iterate' },
            { text: 'Batch', link: '/en/json/api-reference/processor/batch' },
            { text: 'JSONL Processing', link: '/en/json/api-reference/processor/jsonl' },
            { text: 'Lifecycle', link: '/en/json/api-reference/processor/lifecycle' }
          ]
        },
        { text: 'Config', link: '/en/json/api-reference/config' },
        { text: 'Types', link: '/en/json/api-reference/types' },
        { text: 'Interfaces', link: '/en/json/api-reference/interfaces' },
        { text: 'Constants & Errors', link: '/en/json/api-reference/constants' },
        { text: 'Helpers', link: '/en/json/api-reference/helpers' },
        { text: 'Iterator', link: '/en/json/api-reference/iterator' },
        { text: 'Generics', link: '/en/json/api-reference/generics' },
        { text: 'Print Functions', link: '/en/json/api-reference/print' }
      ]
    },
    {
      text: 'Streaming',
      collapsed: true,
      items: [
        { text: 'Large Files Guide', link: '/en/json/large-files' },
        { text: 'Large File API', link: '/en/json/api-reference/large-file' },
        { text: 'JSONL Processor', link: '/en/json/api-reference/jsonl' }
      ]
    },
    {
      text: 'Extension Interfaces',
      collapsed: true,
      items: [
        { text: 'Hook System', link: '/en/json/api-reference/hooks' },
        { text: 'Validator', link: '/en/json/api-reference/validator' },
        { text: 'Custom Encoder', link: '/en/json/api-reference/custom-encoder' }
      ]
    },
    {
      text: 'Security',
      collapsed: true,
      items: [
        { text: 'Security Overview', link: '/en/json/security/' },
        { text: 'Security Mode', link: '/en/json/api-reference/security' },
        { text: 'Production Checklist', link: '/en/json/security/production-checklist' }
      ]
    },
    {
      text: 'Advanced',
      collapsed: true,
      items: [
        { text: 'Performance', link: '/en/json/advanced/performance' },
        { text: 'Error Handling', link: '/en/json/advanced/error-handling' }
      ]
    },
    {
      text: 'Examples',
      collapsed: true,
      items: [
        { text: 'Basic Examples', link: '/en/json/examples' },
        { text: 'Advanced Examples', link: '/en/json/examples-advanced' }
      ]
    }
  ],

  '/en/jwt/': [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/jwt/' },
        { text: 'Quick Start', link: '/en/jwt/getting-started' }
      ]
    },
    {
      text: 'Guides',
      collapsed: false,
      items: [
        { text: 'Signing Algorithms', link: '/en/jwt/guides/signing-algorithms' },
        { text: 'Custom Claims', link: '/en/jwt/guides/custom-claims' },
        { text: 'Token Blacklist', link: '/en/jwt/guides/blacklist' },
        { text: 'Rate Limiting', link: '/en/jwt/guides/rate-limiting' },
        { text: 'Error Handling', link: '/en/jwt/guides/error-handling' },
        { text: 'Testing & Clock Injection', link: '/en/jwt/guides/testing' }
      ]
    },
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/jwt/api-reference/' },
        { text: 'Package Functions', link: '/en/jwt/api-reference/functions' },
        { text: 'Processor', link: '/en/jwt/api-reference/processor' },
        { text: 'Config', link: '/en/jwt/api-reference/config' },
        { text: 'Claims', link: '/en/jwt/api-reference/claims' },
        { text: 'Interfaces', link: '/en/jwt/api-reference/interfaces' },
        { text: 'Types & Constants', link: '/en/jwt/api-reference/types' },
        { text: 'Errors', link: '/en/jwt/api-reference/errors' }
      ]
    },
    {
      text: 'Examples',
      collapsed: false,
      items: [
        { text: 'Basic Examples', link: '/en/jwt/examples/basic' },
        { text: 'Advanced Examples', link: '/en/jwt/examples/advanced' }
      ]
    }
  ],

  '/en/httpc/': [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/httpc/' },
        { text: 'Quick Start', link: '/en/httpc/getting-started' },
        { text: 'Cheat Sheet', link: '/en/httpc/cheatsheet' }
      ]
    },
    {
      text: 'Guides',
      collapsed: false,
      items: [
        { text: 'Tutorial', link: '/en/httpc/guides/tutorial' },
        { text: 'Request & Response', link: '/en/httpc/guides/request-response' },
        { text: 'Domain Client & Sessions', link: '/en/httpc/guides/domain-session' },
        { text: 'File Upload & Download', link: '/en/httpc/guides/file-transfer' },
        { text: 'Retry & Fault Tolerance', link: '/en/httpc/guides/retry-fault-tolerance' },
        { text: 'Middleware Chain', link: '/en/httpc/guides/middleware-chain' },
        { text: 'Testing Guide', link: '/en/httpc/guides/testing' }
      ]
    },
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/httpc/api-reference/' },
        {
          text: 'Core',
          collapsed: false,
          items: [
            { text: 'Package Functions', link: '/en/httpc/api-reference/functions' },
            { text: 'Request Options', link: '/en/httpc/api-reference/options' },
            { text: 'Result', link: '/en/httpc/api-reference/result' }
          ]
        },
        {
          text: 'Client & Config',
          collapsed: true,
          items: [
            { text: 'Configuration', link: '/en/httpc/api-reference/config' },
            { text: 'Domain Client', link: '/en/httpc/api-reference/domain-client' },
            { text: 'Session Management', link: '/en/httpc/api-reference/session' },
            { text: 'File Download', link: '/en/httpc/api-reference/download' },
            { text: 'Middleware', link: '/en/httpc/api-reference/middleware' }
          ]
        },
        {
          text: 'Type Definitions',
          collapsed: true,
          items: [
            { text: 'Interfaces', link: '/en/httpc/api-reference/interfaces' },
            { text: 'Constants & Types', link: '/en/httpc/api-reference/constants' },
            { text: 'Error Types', link: '/en/httpc/api-reference/errors' }
          ]
        }
      ]
    },
    {
      text: 'Security',
      collapsed: false,
      items: [
        { text: 'Security Overview', link: '/en/httpc/security/' },
        { text: 'SSRF Protection', link: '/en/httpc/security/ssrf' },
        { text: 'TLS & Certificate Pinning', link: '/en/httpc/security/tls-certpin' },
        { text: 'Production Checklist', link: '/en/httpc/security/production-checklist' }
      ]
    },
    {
      text: 'Advanced',
      collapsed: true,
      items: [
        { text: 'Performance', link: '/en/httpc/advanced/performance' },
        { text: 'Error Handling', link: '/en/httpc/advanced/error-handling' },
        { text: 'Connection Pool & Proxy', link: '/en/httpc/advanced/connection-pool' }
      ]
    },
    {
      text: 'Examples',
      collapsed: true,
      items: [
        { text: 'Basic Usage', link: '/en/httpc/examples/basic-usage' },
        { text: 'Advanced Usage', link: '/en/httpc/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'FAQ', link: '/en/httpc/faq' }
      ]
    }
  ],

  '/en/html/': [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/html/' },
        { text: 'Quick Start', link: '/en/html/getting-started' },
        { text: 'Cheat Sheet', link: '/en/html/cheatsheet' }
      ]
    },
    {
      text: 'Guides',
      collapsed: false,
      items: [
        {
          text: 'Core Features',
          collapsed: false,
          items: [
            { text: 'Content Extraction', link: '/en/html/guides/content-extraction' },
            { text: 'Output Formats', link: '/en/html/guides/output-formats' },
            { text: 'Link Extraction', link: '/en/html/guides/link-extraction' }
          ]
        },
        {
          text: 'Advanced Patterns',
          collapsed: false,
          items: [
            { text: 'Processor & Cache', link: '/en/html/guides/processor-cache' },
            { text: 'Audit Pipeline', link: '/en/html/guides/audit-pipeline' }
          ]
        },
        {
          text: 'Integration',
          collapsed: true,
          items: [
            { text: 'HTTP Integration', link: '/en/html/guides/http-integration' },
            { text: 'Testing & Custom', link: '/en/html/guides/testing-custom' }
          ]
        }
      ]
    },
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/html/api-reference/' },
        {
          text: 'Core',
          collapsed: false,
          items: [
            { text: 'Functions', link: '/en/html/api-reference/functions' },
            { text: 'Processor', link: '/en/html/api-reference/processor' },
            { text: 'Config', link: '/en/html/api-reference/config' }
          ]
        },
        {
          text: 'Feature Modules',
          collapsed: false,
          items: [
            { text: 'Output Formats', link: '/en/html/api-reference/output' },
            { text: 'Link Extraction', link: '/en/html/api-reference/links' },
            { text: 'Batch Processing', link: '/en/html/api-reference/batch' },
            { text: 'Audit System', link: '/en/html/api-reference/audit' }
          ]
        },
        {
          text: 'Type Definitions',
          collapsed: true,
          items: [
            { text: 'Interfaces', link: '/en/html/api-reference/interfaces' },
            { text: 'Types', link: '/en/html/api-reference/types' },
            { text: 'Constants & Errors', link: '/en/html/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: 'Security',
      collapsed: false,
      items: [
        { text: 'Security Overview', link: '/en/html/security/' },
        { text: 'Production Checklist', link: '/en/html/security/production-checklist' }
      ]
    },
    {
      text: 'Advanced',
      collapsed: true,
      items: [
        { text: 'Performance', link: '/en/html/advanced/performance' },
        { text: 'Error Handling', link: '/en/html/advanced/error-handling' }
      ]
    },
    {
      text: 'Examples',
      collapsed: true,
      items: [
        { text: 'Basic Usage', link: '/en/html/examples/basic-usage' },
        { text: 'Advanced Usage', link: '/en/html/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'FAQ', link: '/en/html/faq' }
      ]
    }
  ],

  '/en/dd/': [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/dd/' },
        { text: 'Quick Start', link: '/en/dd/getting-started' },
        { text: 'Cheat Sheet', link: '/en/dd/cheatsheet' }
      ]
    },
    {
      text: 'Guides',
      collapsed: false,
      items: [
        { text: 'Core Concepts', link: '/en/dd/guides/core-concepts' },
        { text: 'Structured Logging', link: '/en/dd/guides/structured-logging' },
        { text: 'File Output & Rotation', link: '/en/dd/guides/file-output' },
        { text: 'Sensitive Data Filtering', link: '/en/dd/guides/sensitive-filtering' },
        { text: 'Audit Logging', link: '/en/dd/guides/audit-logging' },
        { text: 'Hook System', link: '/en/dd/guides/hooks' },
        { text: 'Distributed Tracing', link: '/en/dd/guides/context-tracing' },
        { text: 'Migration Guide', link: '/en/dd/guides/migration' }
      ]
    },
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/dd/api-reference/' },
        {
          text: 'Core',
          collapsed: false,
          items: [
            { text: 'Package Functions', link: '/en/dd/api-reference/functions' },
            { text: 'Logger', link: '/en/dd/api-reference/logger' },
            { text: 'LoggerEntry', link: '/en/dd/api-reference/entry' },
            { text: 'Config', link: '/en/dd/api-reference/config' },
            { text: 'Interfaces', link: '/en/dd/api-reference/interfaces' }
          ]
        },
        {
          text: 'Output & Integration',
          collapsed: false,
          items: [
            { text: 'Writers', link: '/en/dd/api-reference/writers' },
            { text: 'Context', link: '/en/dd/api-reference/context' },
            { text: 'Fields', link: '/en/dd/api-reference/fields' }
          ]
        },
        {
          text: 'Security & Audit',
          collapsed: true,
          items: [
            { text: 'Hooks', link: '/en/dd/api-reference/hooks' },
            { text: 'Security', link: '/en/dd/api-reference/security' },
            { text: 'Audit', link: '/en/dd/api-reference/audit' },
            { text: 'Integrity', link: '/en/dd/api-reference/integrity' }
          ]
        },
        {
          text: 'Developer Tools',
          collapsed: false,
          items: [
            { text: 'Debug Visual', link: '/en/dd/api-reference/debug-visual' },
            { text: 'Recorder', link: '/en/dd/api-reference/recorder' },
            { text: 'Constants & Errors', link: '/en/dd/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: 'Examples',
      collapsed: false,
      items: [
        { text: 'Basic Usage', link: '/en/dd/examples/basic-usage' },
        { text: 'Web Service Integration', link: '/en/dd/examples/web-service' },
        { text: 'Security & Audit', link: '/en/dd/examples/security-audit' },
        { text: 'Testing Patterns', link: '/en/dd/examples/testing-patterns' }
      ]
    },
    {
      text: 'Security',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/en/dd/security/' },
        { text: 'Industry Compliance', link: '/en/dd/security/compliance' },
        { text: 'Production Checklist', link: '/en/dd/security/production-checklist' }
      ]
    },
    {
      text: 'Advanced',
      collapsed: true,
      items: [
        { text: 'Performance', link: '/en/dd/advanced/performance' },
        { text: 'Error Handling', link: '/en/dd/advanced/error-handling' },
        { text: 'HMAC Signing', link: '/en/dd/advanced/integrity' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'FAQ', link: '/en/dd/faq' }
      ]
    }
  ],

  '/en/env/': [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/env/' },
        { text: 'Quick Start', link: '/en/env/getting-started' },
        { text: 'Cheat Sheet', link: '/en/env/cheatsheet' }
      ]
    },
    {
      text: 'Guides',
      collapsed: false,
      items: [
        { text: 'Struct Mapping', link: '/en/env/guides/struct-mapping' },
        { text: 'Serialization', link: '/en/env/guides/serialization' },
        { text: 'Multi-format Config', link: '/en/env/guides/multi-format' },
        { text: 'Variable Expansion', link: '/en/env/guides/variable-expansion' },
        { text: 'Audit Logging', link: '/en/env/guides/audit-logging' },
        { text: 'Testing Scenarios', link: '/en/env/guides/testing' },
        { text: 'Custom Parser', link: '/en/env/guides/custom-parser' }
      ]
    },
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/en/env/api-reference/' },
        { text: 'Package Functions', link: '/en/env/api-reference/functions' },
        { text: 'Loader', link: '/en/env/api-reference/loader' },
        { text: 'Config', link: '/en/env/api-reference/config' },
        { text: 'SecureValue', link: '/en/env/api-reference/secure-value' },
        { text: 'Interfaces', link: '/en/env/api-reference/interfaces' },
        { text: 'Constants & Errors', link: '/en/env/api-reference/constants' },
        { text: 'Factory', link: '/en/env/api-reference/factory' }
      ]
    },
    {
      text: 'Security',
      collapsed: false,
      items: [
        { text: 'Security Overview', link: '/en/env/security/' },
        { text: 'Production Checklist', link: '/en/env/security/production-checklist' }
      ]
    },
    {
      text: 'Advanced',
      collapsed: false,
      items: [
        { text: 'Performance', link: '/en/env/advanced/performance' },
        { text: 'Error Handling', link: '/en/env/advanced/error-handling' }
      ]
    },
    {
      text: 'Reference',
      collapsed: false,
      items: [
        { text: 'File Format', link: '/en/env/reference/file-format' }
      ]
    }
  ]
}
