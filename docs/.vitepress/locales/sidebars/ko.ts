import type { DefaultTheme } from 'vitepress'

export const koSidebars: Record<string, DefaultTheme.SidebarItem[]> = {
  '/ko/json/': [
    {
      text: '시작하기',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/json/' },
        { text: '빠른 시작', link: '/ko/json/getting-started' },
        { text: '경로 표현식 문법', link: '/ko/json/path-syntax' },
        { text: '치트시트', link: '/ko/json/cheatsheet' }
      ]
    },
    {
      text: 'API 레퍼런스',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/json/api-reference/' },
        {
          text: '패키지 함수',
          collapsed: true,
          items: [
            { text: '개요', link: '/ko/json/api-reference/functions' },
            { text: '조회 및 가져오기', link: '/ko/json/api-reference/functions/get' },
            { text: '수정', link: '/ko/json/api-reference/functions/modify' },
            { text: '인코딩 및 디코딩', link: '/ko/json/api-reference/functions/encode-decode' },
            { text: '파일 I/O', link: '/ko/json/api-reference/functions/file-io' }
          ]
        },
        {
          text: 'Processor',
          collapsed: true,
          items: [
            { text: '개요', link: '/ko/json/api-reference/processor/' },
            { text: '경로 쿼리', link: '/ko/json/api-reference/processor/query' },
            { text: '데이터 수정', link: '/ko/json/api-reference/processor/modify' },
            { text: '출력', link: '/ko/json/api-reference/processor/output' },
            { text: '파싱 및 로딩', link: '/ko/json/api-reference/processor/parse' },
            { text: '반복', link: '/ko/json/api-reference/processor/iterate' },
            { text: '배치', link: '/ko/json/api-reference/processor/batch' },
            { text: 'JSONL 처리', link: '/ko/json/api-reference/processor/jsonl' },
            { text: '라이프사이클', link: '/ko/json/api-reference/processor/lifecycle' }
          ]
        },
        { text: 'Config', link: '/ko/json/api-reference/config' },
        { text: '타입 정의', link: '/ko/json/api-reference/types' },
        { text: '인터페이스', link: '/ko/json/api-reference/interfaces' },
        { text: '상수 및 오류', link: '/ko/json/api-reference/constants' },
        { text: '헬퍼 함수', link: '/ko/json/api-reference/helpers' },
        { text: '반복자', link: '/ko/json/api-reference/iterator' },
        { text: '제네릭', link: '/ko/json/api-reference/generics' },
        { text: '출력 함수', link: '/ko/json/api-reference/print' }
      ]
    },
    {
      text: '스트리밍 처리',
      collapsed: true,
      items: [
        { text: '대용량 파일 가이드', link: '/ko/json/large-files' },
        { text: '대용량 파일 API', link: '/ko/json/api-reference/large-file' },
        { text: 'JSONL 프로세서', link: '/ko/json/api-reference/jsonl' }
      ]
    },
    {
      text: '확장 인터페이스',
      collapsed: true,
      items: [
        { text: 'Hook 시스템', link: '/ko/json/api-reference/hooks' },
        { text: 'Validator', link: '/ko/json/api-reference/validator' },
        { text: '커스텀 인코더', link: '/ko/json/api-reference/custom-encoder' }
      ]
    },
    {
      text: '보안',
      collapsed: true,
      items: [
        { text: '보안 개요', link: '/ko/json/security/' },
        { text: '보안 모드', link: '/ko/json/api-reference/security' },
        { text: '프로덕션 체크리스트', link: '/ko/json/security/production-checklist' }
      ]
    },
    {
      text: '고급',
      collapsed: true,
      items: [
        { text: '성능 최적화', link: '/ko/json/advanced/performance' },
        { text: '오류 처리', link: '/ko/json/advanced/error-handling' }
      ]
    },
    {
      text: '예제',
      collapsed: true,
      items: [
        { text: '기본 예제', link: '/ko/json/examples' },
        { text: '고급 예제', link: '/ko/json/examples-advanced' }
      ]
    }
  ],

  '/ko/jwt/': [
    {
      text: '시작하기',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/jwt/' },
        { text: '빠른 시작', link: '/ko/jwt/getting-started' }
      ]
    },
    {
      text: '가이드',
      collapsed: false,
      items: [
        { text: '서명 알고리즘', link: '/ko/jwt/guides/signing-algorithms' },
        { text: '커스텀 Claims', link: '/ko/jwt/guides/custom-claims' },
        { text: '토큰 블랙리스트', link: '/ko/jwt/guides/blacklist' },
        { text: '속도 제한', link: '/ko/jwt/guides/rate-limiting' },
        { text: '오류 처리', link: '/ko/jwt/guides/error-handling' },
        { text: '테스트와 클럭 인젝션', link: '/ko/jwt/guides/testing' }
      ]
    },
    {
      text: 'API 레퍼런스',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/jwt/api-reference/' },
        { text: '패키지 함수', link: '/ko/jwt/api-reference/functions' },
        { text: 'Processor', link: '/ko/jwt/api-reference/processor' },
        { text: 'Config', link: '/ko/jwt/api-reference/config' },
        { text: 'Claims', link: '/ko/jwt/api-reference/claims' },
        { text: '인터페이스 정의', link: '/ko/jwt/api-reference/interfaces' },
        { text: '타입과 상수', link: '/ko/jwt/api-reference/types' },
        { text: '오류', link: '/ko/jwt/api-reference/errors' }
      ]
    },
    {
      text: '예제',
      collapsed: false,
      items: [
        { text: '기본 예제', link: '/ko/jwt/examples/basic' },
        { text: '고급 예제', link: '/ko/jwt/examples/advanced' }
      ]
    }
  ],

  '/ko/httpc/': [
    {
      text: '시작하기',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/httpc/' },
        { text: '빠른 시작', link: '/ko/httpc/getting-started' },
        { text: '치트시트', link: '/ko/httpc/cheatsheet' }
      ]
    },
    {
      text: '가이드',
      collapsed: false,
      items: [
        { text: '실전 튜토리얼', link: '/ko/httpc/guides/tutorial' },
        { text: '요청과 응답', link: '/ko/httpc/guides/request-response' },
        { text: '도메인 클라이언트와 세션', link: '/ko/httpc/guides/domain-session' },
        { text: '파일 업로드와 다운로드', link: '/ko/httpc/guides/file-transfer' },
        { text: '재시도와 장애 허용', link: '/ko/httpc/guides/retry-fault-tolerance' },
        { text: '미들웨어 체인', link: '/ko/httpc/guides/middleware-chain' },
        { text: '테스트 가이드', link: '/ko/httpc/guides/testing' }
      ]
    },
    {
      text: 'API 레퍼런스',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/httpc/api-reference/' },
        {
          text: '핵심',
          collapsed: false,
          items: [
            { text: '패키지 함수', link: '/ko/httpc/api-reference/functions' },
            { text: '요청 옵션', link: '/ko/httpc/api-reference/options' },
            { text: 'Result', link: '/ko/httpc/api-reference/result' }
          ]
        },
        {
          text: '클라이언트와 설정',
          collapsed: true,
          items: [
            { text: '설정', link: '/ko/httpc/api-reference/config' },
            { text: '도메인 클라이언트', link: '/ko/httpc/api-reference/domain-client' },
            { text: '세션 관리', link: '/ko/httpc/api-reference/session' },
            { text: '파일 다운로드', link: '/ko/httpc/api-reference/download' },
            { text: '미들웨어', link: '/ko/httpc/api-reference/middleware' }
          ]
        },
        {
          text: '타입 정의',
          collapsed: true,
          items: [
            { text: '인터페이스 정의', link: '/ko/httpc/api-reference/interfaces' },
            { text: '상수와 타입', link: '/ko/httpc/api-reference/constants' },
            { text: '오류 타입', link: '/ko/httpc/api-reference/errors' }
          ]
        }
      ]
    },
    {
      text: '보안',
      collapsed: false,
      items: [
        { text: '보안 개요', link: '/ko/httpc/security/' },
        { text: 'SSRF 방어', link: '/ko/httpc/security/ssrf' },
        { text: 'TLS와 인증서 고정', link: '/ko/httpc/security/tls-certpin' },
        { text: '프로덕션 체크리스트', link: '/ko/httpc/security/production-checklist' }
      ]
    },
    {
      text: '고급',
      collapsed: true,
      items: [
        { text: '성능 최적화', link: '/ko/httpc/advanced/performance' },
        { text: '오류 처리', link: '/ko/httpc/advanced/error-handling' },
        { text: '연결 풀과 프록시', link: '/ko/httpc/advanced/connection-pool' }
      ]
    },
    {
      text: '예제',
      collapsed: true,
      items: [
        { text: '기본 예제', link: '/ko/httpc/examples/basic-usage' },
        { text: '고급 예제', link: '/ko/httpc/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: '자주 묻는 질문', link: '/ko/httpc/faq' }
      ]
    }
  ],

  '/ko/html/': [
    {
      text: '시작하기',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/html/' },
        { text: '빠른 시작', link: '/ko/html/getting-started' },
        { text: '치트시트', link: '/ko/html/cheatsheet' }
      ]
    },
    {
      text: '가이드',
      collapsed: false,
      items: [
        {
          text: '핵심 기능',
          collapsed: false,
          items: [
            { text: '콘텐츠 추출 실전', link: '/ko/html/guides/content-extraction' },
            { text: '출력 형식 선택', link: '/ko/html/guides/output-formats' },
            { text: '링크 추출과 그룹화', link: '/ko/html/guides/link-extraction' }
          ]
        },
        {
          text: '고급 패턴',
          collapsed: false,
          items: [
            { text: 'Processor 재사용과 캐시', link: '/ko/html/guides/processor-cache' },
            { text: '감사 시스템 실전', link: '/ko/html/guides/audit-pipeline' }
          ]
        },
        {
          text: '통합과 확장',
          collapsed: true,
          items: [
            { text: 'HTTP 통합', link: '/ko/html/guides/http-integration' },
            { text: '테스트와 커스텀 확장', link: '/ko/html/guides/testing-custom' }
          ]
        }
      ]
    },
    {
      text: 'API 레퍼런스',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/html/api-reference/' },
        {
          text: '핵심',
          collapsed: false,
          items: [
            { text: '패키지 함수', link: '/ko/html/api-reference/functions' },
            { text: 'Processor', link: '/ko/html/api-reference/processor' },
            { text: '설정', link: '/ko/html/api-reference/config' }
          ]
        },
        {
          text: '기능 모듈',
          collapsed: false,
          items: [
            { text: '출력 형식', link: '/ko/html/api-reference/output' },
            { text: '링크 추출', link: '/ko/html/api-reference/links' },
            { text: '배치 처리', link: '/ko/html/api-reference/batch' },
            { text: '감사 시스템', link: '/ko/html/api-reference/audit' }
          ]
        },
        {
          text: '타입 정의',
          collapsed: true,
          items: [
            { text: '인터페이스 정의', link: '/ko/html/api-reference/interfaces' },
            { text: '타입 정의', link: '/ko/html/api-reference/types' },
            { text: '상수와 오류', link: '/ko/html/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: '보안',
      collapsed: false,
      items: [
        { text: '보안 개요', link: '/ko/html/security/' },
        { text: '프로덕션 체크리스트', link: '/ko/html/security/production-checklist' }
      ]
    },
    {
      text: '고급',
      collapsed: true,
      items: [
        { text: '성능 최적화', link: '/ko/html/advanced/performance' },
        { text: '오류 처리', link: '/ko/html/advanced/error-handling' }
      ]
    },
    {
      text: '예제',
      collapsed: true,
      items: [
        { text: '기본 예제', link: '/ko/html/examples/basic-usage' },
        { text: '고급 예제', link: '/ko/html/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: '자주 묻는 질문', link: '/ko/html/faq' }
      ]
    }
  ],
  '/ko/dd/': [
    {
      text: '시작하기',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/dd/' },
        { text: '빠른 시작', link: '/ko/dd/getting-started' },
        { text: '치트시트', link: '/ko/dd/cheatsheet' }
      ]
    },
    {
      text: '가이드',
      collapsed: false,
      items: [
        { text: '핵심 개념', link: '/ko/dd/guides/core-concepts' },
        { text: '구조화된 로깅', link: '/ko/dd/guides/structured-logging' },
        { text: '파일 출력과 로테이션', link: '/ko/dd/guides/file-output' },
        { text: '민감 데이터 필터링', link: '/ko/dd/guides/sensitive-filtering' },
        { text: '감사 로그', link: '/ko/dd/guides/audit-logging' },
        { text: '훅 시스템', link: '/ko/dd/guides/hooks' },
        { text: '분산 추적 통합', link: '/ko/dd/guides/context-tracing' },
        { text: '마이그레이션 가이드', link: '/ko/dd/guides/migration' }
      ]
    },
    {
      text: 'API 레퍼런스',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/dd/api-reference/' },
        {
          text: '핵심',
          collapsed: false,
          items: [
            { text: '패키지 함수', link: '/ko/dd/api-reference/functions' },
            { text: 'Logger', link: '/ko/dd/api-reference/logger' },
            { text: 'LoggerEntry', link: '/ko/dd/api-reference/entry' },
            { text: '설정', link: '/ko/dd/api-reference/config' },
            { text: '인터페이스 정의', link: '/ko/dd/api-reference/interfaces' }
          ]
        },
        {
          text: '출력과 통합',
          collapsed: false,
          items: [
            { text: '출력 대상', link: '/ko/dd/api-reference/writers' },
            { text: '컨텍스트 통합', link: '/ko/dd/api-reference/context' },
            { text: '구조화된 필드', link: '/ko/dd/api-reference/fields' }
          ]
        },
        {
          text: '보안과 감사',
          collapsed: true,
          items: [
            { text: '훅 시스템', link: '/ko/dd/api-reference/hooks' },
            { text: '보안 필터', link: '/ko/dd/api-reference/security' },
            { text: '감사 로그', link: '/ko/dd/api-reference/audit' },
            { text: '무결성 서명', link: '/ko/dd/api-reference/integrity' }
          ]
        },
        {
          text: '개발 도구',
          collapsed: false,
          items: [
            { text: '디버그 출력', link: '/ko/dd/api-reference/debug-visual' },
            { text: '테스트 보조', link: '/ko/dd/api-reference/recorder' },
            { text: '상수와 오류', link: '/ko/dd/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: '예제',
      collapsed: false,
      items: [
        { text: '기본 사용법', link: '/ko/dd/examples/basic-usage' },
        { text: '웹 서비스 통합', link: '/ko/dd/examples/web-service' },
        { text: '보안과 감사 실전', link: '/ko/dd/examples/security-audit' },
        { text: '테스트 패턴', link: '/ko/dd/examples/testing-patterns' }
      ]
    },
    {
      text: '보안',
      collapsed: true,
      items: [
        { text: '개요', link: '/ko/dd/security/' },
        { text: '산업 규정 준수 설정', link: '/ko/dd/security/compliance' },
        { text: '프로덕션 체크리스트', link: '/ko/dd/security/production-checklist' }
      ]
    },
    {
      text: '고급',
      collapsed: true,
      items: [
        { text: '성능', link: '/ko/dd/advanced/performance' },
        { text: '오류 처리', link: '/ko/dd/advanced/error-handling' },
        { text: 'HMAC 서명 실전', link: '/ko/dd/advanced/integrity' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: '자주 묻는 질문', link: '/ko/dd/faq' }
      ]
    }
  ],

  '/ko/env/': [
    {
      text: '시작하기',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/env/' },
        { text: '빠른 시작', link: '/ko/env/getting-started' },
        { text: '치트시트', link: '/ko/env/cheatsheet' }
      ]
    },
    {
      text: '가이드',
      collapsed: false,
      items: [
        { text: '구조체 매핑', link: '/ko/env/guides/struct-mapping' },
        { text: '직렬화', link: '/ko/env/guides/serialization' },
        { text: '다중 포맷 설정', link: '/ko/env/guides/multi-format' },
        { text: '변수 확장', link: '/ko/env/guides/variable-expansion' },
        { text: '감사 로그', link: '/ko/env/guides/audit-logging' },
        { text: '테스트 시나리오', link: '/ko/env/guides/testing' },
        { text: '커스텀 파서', link: '/ko/env/guides/custom-parser' }
      ]
    },
    {
      text: 'API 레퍼런스',
      collapsed: false,
      items: [
        { text: '개요', link: '/ko/env/api-reference/' },
        { text: '패키지 함수', link: '/ko/env/api-reference/functions' },
        { text: 'Loader', link: '/ko/env/api-reference/loader' },
        { text: 'Config', link: '/ko/env/api-reference/config' },
        { text: 'SecureValue', link: '/ko/env/api-reference/secure-value' },
        { text: '인터페이스 정의', link: '/ko/env/api-reference/interfaces' },
        { text: '상수 및 오류', link: '/ko/env/api-reference/constants' },
        { text: '컴포넌트 팩토리', link: '/ko/env/api-reference/factory' }
      ]
    },
    {
      text: '보안',
      collapsed: false,
      items: [
        { text: '보안 개요', link: '/ko/env/security/' },
        { text: '프로덕션 체크리스트', link: '/ko/env/security/production-checklist' }
      ]
    },
    {
      text: '고급',
      collapsed: false,
      items: [
        { text: '성능 최적화', link: '/ko/env/advanced/performance' },
        { text: '오류 처리', link: '/ko/env/advanced/error-handling' }
      ]
    },
    {
      text: '참조',
      collapsed: false,
      items: [
        { text: '파일 포맷', link: '/ko/env/reference/file-format' }
      ]
    }
  ]
}
