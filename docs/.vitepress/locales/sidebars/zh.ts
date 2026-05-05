import type { DefaultTheme } from 'vitepress'

export const zhSidebars: Record<string, DefaultTheme.SidebarItem[]> = {
  '/zh/json/': [
    {
      text: '开始',
      collapsed: false,
      items: [
        { text: '概述', link: '/zh/json/' },
        { text: '快速开始', link: '/zh/json/getting-started' },
        { text: '路径表达式语法', link: '/zh/json/path-syntax' },
        { text: '速查表', link: '/zh/json/cheatsheet' }
      ]
    },
    {
      text: 'API 参考',
      collapsed: false,
      items: [
        { text: '概述', link: '/zh/json/api-reference/' },
        {
          text: '包函数',
          collapsed: true,
          items: [
            { text: '概览', link: '/zh/json/api-reference/functions' },
            { text: '查询获取', link: '/zh/json/api-reference/functions/get' },
            { text: '修改操作', link: '/zh/json/api-reference/functions/modify' },
            { text: '编码解码', link: '/zh/json/api-reference/functions/encode-decode' },
            { text: '文件操作', link: '/zh/json/api-reference/functions/file-io' }
          ]
        },
        {
          text: 'Processor',
          collapsed: true,
          items: [
            { text: '概述', link: '/zh/json/api-reference/processor/' },
            { text: '路径查询', link: '/zh/json/api-reference/processor/query' },
            { text: '数据修改', link: '/zh/json/api-reference/processor/modify' },
            { text: '输出方法', link: '/zh/json/api-reference/processor/output' },
            { text: '解析与加载', link: '/zh/json/api-reference/processor/parse' },
            { text: '迭代方法', link: '/zh/json/api-reference/processor/iterate' },
            { text: '批量操作', link: '/zh/json/api-reference/processor/batch' },
            { text: 'JSONL 处理', link: '/zh/json/api-reference/processor/jsonl' },
            { text: '生命周期', link: '/zh/json/api-reference/processor/lifecycle' }
          ]
        },
        { text: 'Config', link: '/zh/json/api-reference/config' },
        { text: '类型定义', link: '/zh/json/api-reference/types' },
        { text: '接口定义', link: '/zh/json/api-reference/interfaces' },
        { text: '常量与错误', link: '/zh/json/api-reference/constants' },
        { text: '辅助函数', link: '/zh/json/api-reference/helpers' },
        { text: '迭代器', link: '/zh/json/api-reference/iterator' },
        { text: '泛型操作', link: '/zh/json/api-reference/generics' },
        { text: '打印函数', link: '/zh/json/api-reference/print' }
      ]
    },
    {
      text: '流式处理',
      collapsed: true,
      items: [
        { text: '大文件处理指南', link: '/zh/json/large-files' },
        { text: '大文件处理 API', link: '/zh/json/api-reference/large-file' },
        { text: 'JSONL 处理器', link: '/zh/json/api-reference/jsonl' }
      ]
    },
    {
      text: '扩展接口',
      collapsed: true,
      items: [
        { text: 'Hook 钩子系统', link: '/zh/json/api-reference/hooks' },
        { text: 'Validator 验证器', link: '/zh/json/api-reference/validator' },
        { text: '自定义编码器', link: '/zh/json/api-reference/custom-encoder' }
      ]
    },
    {
      text: '安全',
      collapsed: true,
      items: [
        { text: '安全概述', link: '/zh/json/security/' },
        { text: '安全模式', link: '/zh/json/api-reference/security' },
        { text: '生产检查清单', link: '/zh/json/security/production-checklist' }
      ]
    },
    {
      text: '进阶',
      collapsed: true,
      items: [
        { text: '性能优化', link: '/zh/json/advanced/performance' },
        { text: '错误处理', link: '/zh/json/advanced/error-handling' }
      ]
    },
    {
      text: '示例',
      collapsed: true,
      items: [
        { text: '基础示例', link: '/zh/json/examples' },
        { text: '高级示例', link: '/zh/json/examples-advanced' }
      ]
    }
  ],

  '/zh/jwt/': [
    {
      text: '开始',
      collapsed: false,
      items: [
        { text: '概述', link: '/zh/jwt/' },
        { text: '快速开始', link: '/zh/jwt/getting-started' }
      ]
    },
    {
      text: '指南',
      collapsed: false,
      items: [
        { text: '签名算法', link: '/zh/jwt/guides/signing-algorithms' },
        { text: '自定义 Claims', link: '/zh/jwt/guides/custom-claims' },
        { text: '令牌黑名单', link: '/zh/jwt/guides/blacklist' },
        { text: '速率限制', link: '/zh/jwt/guides/rate-limiting' },
        { text: '错误处理', link: '/zh/jwt/guides/error-handling' },
        { text: '测试与时钟注入', link: '/zh/jwt/guides/testing' }
      ]
    },
    {
      text: 'API 参考',
      collapsed: false,
      items: [
        { text: '概览', link: '/zh/jwt/api-reference/' },
        { text: '包函数', link: '/zh/jwt/api-reference/functions' },
        { text: 'Processor', link: '/zh/jwt/api-reference/processor' },
        { text: 'Config', link: '/zh/jwt/api-reference/config' },
        { text: 'Claims', link: '/zh/jwt/api-reference/claims' },
        { text: '接口定义', link: '/zh/jwt/api-reference/interfaces' },
        { text: '类型与常量', link: '/zh/jwt/api-reference/types' },
        { text: '错误', link: '/zh/jwt/api-reference/errors' }
      ]
    },
    {
      text: '示例',
      collapsed: false,
      items: [
        { text: '基础示例', link: '/zh/jwt/examples/basic' },
        { text: '高级示例', link: '/zh/jwt/examples/advanced' }
      ]
    }
  ],

  '/zh/httpc/': [
    {
      text: '开始',
      collapsed: false,
      items: [
        { text: '概述', link: '/zh/httpc/' },
        { text: '快速开始', link: '/zh/httpc/getting-started' },
        { text: '速查表', link: '/zh/httpc/cheatsheet' }
      ]
    },
    {
      text: '指南',
      collapsed: false,
      items: [
        { text: '实战教程', link: '/zh/httpc/guides/tutorial' },
        { text: '发送请求与处理响应', link: '/zh/httpc/guides/request-response' },
        { text: '域名客户端与会话', link: '/zh/httpc/guides/domain-session' },
        { text: '文件上传与下载', link: '/zh/httpc/guides/file-transfer' },
        { text: '重试与容错', link: '/zh/httpc/guides/retry-fault-tolerance' },
        { text: '中间件链', link: '/zh/httpc/guides/middleware-chain' },
        { text: '测试指南', link: '/zh/httpc/guides/testing' }
      ]
    },
    {
      text: 'API 参考',
      collapsed: false,
      items: [
        { text: '概览', link: '/zh/httpc/api-reference/' },
        {
          text: '核心',
          collapsed: false,
          items: [
            { text: '包函数', link: '/zh/httpc/api-reference/functions' },
            { text: '请求选项', link: '/zh/httpc/api-reference/options' },
            { text: 'Result', link: '/zh/httpc/api-reference/result' }
          ]
        },
        {
          text: '客户端与配置',
          collapsed: true,
          items: [
            { text: '配置', link: '/zh/httpc/api-reference/config' },
            { text: '域名客户端', link: '/zh/httpc/api-reference/domain-client' },
            { text: '会话管理', link: '/zh/httpc/api-reference/session' },
            { text: '文件下载', link: '/zh/httpc/api-reference/download' },
            { text: '中间件', link: '/zh/httpc/api-reference/middleware' }
          ]
        },
        {
          text: '类型定义',
          collapsed: true,
          items: [
            { text: '接口定义', link: '/zh/httpc/api-reference/interfaces' },
            { text: '常量与类型', link: '/zh/httpc/api-reference/constants' },
            { text: '错误类型', link: '/zh/httpc/api-reference/errors' }
          ]
        }
      ]
    },
    {
      text: '安全',
      collapsed: false,
      items: [
        { text: '安全概述', link: '/zh/httpc/security/' },
        { text: 'SSRF 防护', link: '/zh/httpc/security/ssrf' },
        { text: 'TLS 与证书固定', link: '/zh/httpc/security/tls-certpin' },
        { text: '生产检查清单', link: '/zh/httpc/security/production-checklist' }
      ]
    },
    {
      text: '进阶',
      collapsed: true,
      items: [
        { text: '性能优化', link: '/zh/httpc/advanced/performance' },
        { text: '错误处理', link: '/zh/httpc/advanced/error-handling' },
        { text: '连接池与代理', link: '/zh/httpc/advanced/connection-pool' }
      ]
    },
    {
      text: '示例',
      collapsed: true,
      items: [
        { text: '基础示例', link: '/zh/httpc/examples/basic-usage' },
        { text: '高级示例', link: '/zh/httpc/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: '常见问题', link: '/zh/httpc/faq' }
      ]
    }
  ],

  '/zh/html/': [
    {
      text: '开始',
      collapsed: false,
      items: [
        { text: '概述', link: '/zh/html/' },
        { text: '快速开始', link: '/zh/html/getting-started' },
        { text: '速查表', link: '/zh/html/cheatsheet' }
      ]
    },
    {
      text: '指南',
      collapsed: false,
      items: [
        {
          text: '核心功能',
          collapsed: false,
          items: [
            { text: '内容提取实战', link: '/zh/html/guides/content-extraction' },
            { text: '输出格式选择', link: '/zh/html/guides/output-formats' },
            { text: '链接提取与分组', link: '/zh/html/guides/link-extraction' }
          ]
        },
        {
          text: '高级模式',
          collapsed: false,
          items: [
            { text: 'Processor 复用与缓存', link: '/zh/html/guides/processor-cache' },
            { text: '审计系统实战', link: '/zh/html/guides/audit-pipeline' }
          ]
        },
        {
          text: '集成与扩展',
          collapsed: true,
          items: [
            { text: 'HTTP 集成', link: '/zh/html/guides/http-integration' },
            { text: '测试与自定义扩展', link: '/zh/html/guides/testing-custom' }
          ]
        }
      ]
    },
    {
      text: 'API 参考',
      collapsed: false,
      items: [
        { text: '概览', link: '/zh/html/api-reference/' },
        {
          text: '核心',
          collapsed: false,
          items: [
            { text: '包函数', link: '/zh/html/api-reference/functions' },
            { text: 'Processor', link: '/zh/html/api-reference/processor' },
            { text: '配置', link: '/zh/html/api-reference/config' }
          ]
        },
        {
          text: '功能模块',
          collapsed: false,
          items: [
            { text: '输出格式', link: '/zh/html/api-reference/output' },
            { text: '链接提取', link: '/zh/html/api-reference/links' },
            { text: '批量处理', link: '/zh/html/api-reference/batch' },
            { text: '审计系统', link: '/zh/html/api-reference/audit' }
          ]
        },
        {
          text: '类型定义',
          collapsed: true,
          items: [
            { text: '接口定义', link: '/zh/html/api-reference/interfaces' },
            { text: '类型定义', link: '/zh/html/api-reference/types' },
            { text: '常量与错误', link: '/zh/html/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: '安全',
      collapsed: false,
      items: [
        { text: '安全概述', link: '/zh/html/security/' },
        { text: '生产检查清单', link: '/zh/html/security/production-checklist' }
      ]
    },
    {
      text: '进阶',
      collapsed: true,
      items: [
        { text: '性能优化', link: '/zh/html/advanced/performance' },
        { text: '错误处理', link: '/zh/html/advanced/error-handling' }
      ]
    },
    {
      text: '示例',
      collapsed: true,
      items: [
        { text: '基础用法', link: '/zh/html/examples/basic-usage' },
        { text: '高级示例', link: '/zh/html/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: '常见问题', link: '/zh/html/faq' }
      ]
    }
  ],

  '/zh/dd/': [
    {
      text: '开始',
      collapsed: false,
      items: [
        { text: '概述', link: '/zh/dd/' },
        { text: '快速开始', link: '/zh/dd/getting-started' },
        { text: '速查表', link: '/zh/dd/cheatsheet' }
      ]
    },
    {
      text: '指南',
      collapsed: false,
      items: [
        { text: '核心概念', link: '/zh/dd/guides/core-concepts' },
        { text: '结构化日志', link: '/zh/dd/guides/structured-logging' },
        { text: '文件输出与轮换', link: '/zh/dd/guides/file-output' },
        { text: '敏感数据过滤', link: '/zh/dd/guides/sensitive-filtering' },
        { text: '审计日志', link: '/zh/dd/guides/audit-logging' },
        { text: '钩子系统', link: '/zh/dd/guides/hooks' },
        { text: '分布式追踪集成', link: '/zh/dd/guides/context-tracing' },
        { text: '迁移指南', link: '/zh/dd/guides/migration' }
      ]
    },
    {
      text: 'API 参考',
      collapsed: false,
      items: [
        { text: '概览', link: '/zh/dd/api-reference/' },
        {
          text: '核心',
          collapsed: false,
          items: [
            { text: '包函数', link: '/zh/dd/api-reference/functions' },
            { text: 'Logger', link: '/zh/dd/api-reference/logger' },
            { text: 'LoggerEntry', link: '/zh/dd/api-reference/entry' },
            { text: '配置', link: '/zh/dd/api-reference/config' },
            { text: '接口定义', link: '/zh/dd/api-reference/interfaces' }
          ]
        },
        {
          text: '输出与集成',
          collapsed: false,
          items: [
            { text: '输出目标', link: '/zh/dd/api-reference/writers' },
            { text: '上下文集成', link: '/zh/dd/api-reference/context' },
            { text: '结构化字段', link: '/zh/dd/api-reference/fields' }
          ]
        },
        {
          text: '安全与审计',
          collapsed: true,
          items: [
            { text: '钩子系统', link: '/zh/dd/api-reference/hooks' },
            { text: '安全过滤', link: '/zh/dd/api-reference/security' },
            { text: '审计日志', link: '/zh/dd/api-reference/audit' },
            { text: '完整性签名', link: '/zh/dd/api-reference/integrity' }
          ]
        },
        {
          text: '开发工具',
          collapsed: false,
          items: [
            { text: '调试输出', link: '/zh/dd/api-reference/debug-visual' },
            { text: '测试辅助', link: '/zh/dd/api-reference/recorder' },
            { text: '常量与错误', link: '/zh/dd/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: '示例',
      collapsed: false,
      items: [
        { text: '基础用法', link: '/zh/dd/examples/basic-usage' },
        { text: 'Web 服务集成', link: '/zh/dd/examples/web-service' },
        { text: '安全与审计实战', link: '/zh/dd/examples/security-audit' },
        { text: '测试模式', link: '/zh/dd/examples/testing-patterns' }
      ]
    },
    {
      text: '安全',
      collapsed: true,
      items: [
        { text: '概述', link: '/zh/dd/security/' },
        { text: '行业合规配置', link: '/zh/dd/security/compliance' },
        { text: '生产检查清单', link: '/zh/dd/security/production-checklist' }
      ]
    },
    {
      text: '进阶',
      collapsed: true,
      items: [
        { text: '性能', link: '/zh/dd/advanced/performance' },
        { text: '错误处理', link: '/zh/dd/advanced/error-handling' },
        { text: 'HMAC 签名实战', link: '/zh/dd/advanced/integrity' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: '常见问题', link: '/zh/dd/faq' }
      ]
    }
  ],

  '/zh/env/': [
    {
      text: '开始',
      collapsed: false,
      items: [
        { text: '概述', link: '/zh/env/' },
        { text: '快速开始', link: '/zh/env/getting-started' },
        { text: '速查表', link: '/zh/env/cheatsheet' }
      ]
    },
    {
      text: '指南',
      collapsed: false,
      items: [
        { text: '结构体映射', link: '/zh/env/guides/struct-mapping' },
        { text: '序列化', link: '/zh/env/guides/serialization' },
        { text: '多格式配置', link: '/zh/env/guides/multi-format' },
        { text: '变量展开', link: '/zh/env/guides/variable-expansion' },
        { text: '审计日志', link: '/zh/env/guides/audit-logging' },
        { text: '测试场景', link: '/zh/env/guides/testing' },
        { text: '自定义解析器', link: '/zh/env/guides/custom-parser' }
      ]
    },
    {
      text: 'API 参考',
      collapsed: false,
      items: [
        { text: '概述', link: '/zh/env/api-reference/' },
        { text: '包函数', link: '/zh/env/api-reference/functions' },
        { text: 'Loader', link: '/zh/env/api-reference/loader' },
        { text: 'Config', link: '/zh/env/api-reference/config' },
        { text: 'SecureValue', link: '/zh/env/api-reference/secure-value' },
        { text: '接口定义', link: '/zh/env/api-reference/interfaces' },
        { text: '常量与错误', link: '/zh/env/api-reference/constants' },
        { text: '组件工厂', link: '/zh/env/api-reference/factory' }
      ]
    },
    {
      text: '安全',
      collapsed: false,
      items: [
        { text: '安全概述', link: '/zh/env/security/' },
        { text: '生产检查清单', link: '/zh/env/security/production-checklist' }
      ]
    },
    {
      text: '高级',
      collapsed: false,
      items: [
        { text: '性能优化', link: '/zh/env/advanced/performance' },
        { text: '错误处理', link: '/zh/env/advanced/error-handling' }
      ]
    },
    {
      text: '参考',
      collapsed: false,
      items: [
        { text: '文件格式', link: '/zh/env/reference/file-format' }
      ]
    }
  ]
}
