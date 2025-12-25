import { vi } from 'vitest';

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark'],
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Setup global fetch mock
global.fetch = vi.fn();

// Setup Response if not available
if (typeof Response === 'undefined') {
  global.Response = class Response {
    body: ReadableStream | null = null;
    bodyUsed = false;
    headers: Headers;
    ok: boolean;
    redirected = false;
    status: number;
    statusText: string;
    type: ResponseType = 'basic';
    url = '';

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.statusText = init?.statusText ?? '';
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new Headers(init?.headers);
      if (body) {
        this.body = new ReadableStream();
      }
    }

    async json() {
      return {};
    }

    async text() {
      return '';
    }

    async blob() {
      return new Blob();
    }

    async arrayBuffer() {
      return new ArrayBuffer(0);
    }

    async formData() {
      return new FormData();
    }

    clone() {
      return new Response();
    }
  } as unknown as typeof Response;
}

// Setup btoa/atob for JWT handling in tests
if (typeof btoa === 'undefined') {
  global.btoa = (str: string) => Buffer.from(str).toString('base64');
}

if (typeof atob === 'undefined') {
  global.atob = (str: string) => Buffer.from(str, 'base64').toString();
}
