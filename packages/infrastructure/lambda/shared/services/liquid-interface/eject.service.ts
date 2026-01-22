// RADIANT v4.18.0 - Liquid Interface Eject Service
// "The Takeout Button" - Export ephemeral apps to deployable codebases
// Zero-risk prototyping → Production-ready applications

import { executeStatement, stringParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import {
  EjectConfig,
  EjectResult,
  EjectFile,
  EjectRequest,
  EjectResponse,
  LiquidSchema,
  LiquidSession,
  EjectDependency,
  EjectSecret,
} from '@radiant/shared';
import { liquidInterfaceService } from './liquid-interface.service';
import { COMPONENT_REGISTRY, getComponent } from './component-registry';

// ============================================================================
// Framework Templates
// ============================================================================

// Config file contents
const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;
`;
const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
const TS_CONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "app"]
}
`;
const TAILWIND_CONFIG = `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
`;
const POSTCSS_CONFIG = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

const FRAMEWORK_TEMPLATES: Record<string, FrameworkTemplate> = {
  nextjs: {
    name: 'Next.js',
    version: '14.0',
    packageJson: {
      name: '{{PROJECT_NAME}}',
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      },
      dependencies: {
        'next': '^14.0.0',
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/node': '^20',
        '@types/react': '^18',
        '@types/react-dom': '^18',
        'typescript': '^5',
        'tailwindcss': '^3.4',
        'postcss': '^8',
        'autoprefixer': '^10',
      },
    },
    configFiles: [
      { path: 'next.config.mjs', content: NEXT_CONFIG },
      { path: 'tsconfig.json', content: TS_CONFIG },
      { path: 'tailwind.config.ts', content: TAILWIND_CONFIG },
      { path: 'postcss.config.mjs', content: POSTCSS_CONFIG },
    ],
  },
  vite: {
    name: 'Vite + React',
    version: '5.0',
    packageJson: {
      name: '{{PROJECT_NAME}}',
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/react': '^18',
        '@types/react-dom': '^18',
        '@vitejs/plugin-react': '^4',
        'typescript': '^5',
        'vite': '^5',
        'tailwindcss': '^3.4',
        'postcss': '^8',
        'autoprefixer': '^10',
      },
    },
    configFiles: [
      { path: 'vite.config.ts', content: VITE_CONFIG },
      { path: 'tsconfig.json', content: TS_CONFIG },
      { path: 'tailwind.config.ts', content: TAILWIND_CONFIG },
      { path: 'postcss.config.mjs', content: POSTCSS_CONFIG },
    ],
  },
};






interface FrameworkTemplate {
  name: string;
  version: string;
  packageJson: Record<string, unknown>;
  configFiles: Array<{ path: string; content: string }>;
}

// ============================================================================
// Eject Service
// ============================================================================

class EjectService {
  // --------------------------------------------------------------------------
  // Main Eject Flow
  // --------------------------------------------------------------------------

  async eject(request: EjectRequest): Promise<EjectResponse> {
    const { sessionId, config } = request;

    logger.info('Starting eject process', { sessionId, framework: config.framework });

    try {
      // Get session and schema
      const session = await this.getSession(sessionId);
      if (!session || !session.currentSchema) {
        throw new Error('No active liquid session or schema to eject');
      }

      // Generate files
      const files = await this.generateFiles(session, config);

      // Generate setup instructions
      const setupInstructions = this.generateSetupInstructions(config);

      // Generate env example
      const envExample = this.generateEnvExample(config.secrets);

      // Record eject event
      await this.recordEject(sessionId, config, files.length);

      const result: EjectResult = {
        id: `eject_${Date.now()}`,
        status: 'success',
        files,
        setupInstructions,
        envExample,
        warnings: this.generateWarnings(session.currentSchema, config),
      };

      logger.info('Eject completed', { 
        sessionId, 
        fileCount: files.length,
        framework: config.framework,
      });

      return { result };
    } catch (error) {
      logger.error('Eject failed', { sessionId, error });
      
      return {
        result: {
          id: `eject_${Date.now()}`,
          status: 'failed',
          files: [],
          setupInstructions: [],
          envExample: '',
          warnings: [String(error)],
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // File Generation
  // --------------------------------------------------------------------------

  private async generateFiles(session: LiquidSession, config: EjectConfig): Promise<EjectFile[]> {
    const files: EjectFile[] = [];
    const framework = FRAMEWORK_TEMPLATES[config.framework] || FRAMEWORK_TEMPLATES.nextjs;
    const schema = session.currentSchema!;

    // 1. Package.json
    const packageJson = this.buildPackageJson(framework, config);
    files.push({
      path: 'package.json',
      content: JSON.stringify(packageJson, null, 2),
      type: 'config',
    });

    // 2. Config files
    for (const configFile of framework.configFiles) {
      files.push({
        path: configFile.path,
        content: configFile.content,
        type: 'config',
      });
    }

    // 3. Main app entry
    files.push(this.generateAppEntry(config.framework));

    // 4. Layout component
    files.push(this.generateLayout(schema, config.framework));

    // 5. Component files
    const componentFiles = this.generateComponentFiles(schema);
    files.push(...componentFiles);

    // 6. Types file
    files.push(this.generateTypesFile(schema));

    // 7. State store
    files.push(this.generateStateStore(schema));

    // 8. Feature-specific files
    if (config.features.includes('database')) {
      files.push(...this.generateDatabaseFiles(session));
    }

    if (config.features.includes('api')) {
      files.push(...this.generateAPIFiles(config.framework));
    }

    if (config.features.includes('ai')) {
      files.push(...this.generateAIIntegrationFiles());
    }

    // 9. README
    files.push(this.generateReadme(config));

    // 10. .env.example
    files.push({
      path: '.env.example',
      content: this.generateEnvExample(config.secrets),
      type: 'config',
    });

    // 11. .gitignore
    files.push({
      path: '.gitignore',
      content: GITIGNORE_CONTENT,
      type: 'config',
    });

    return files;
  }

  private buildPackageJson(template: FrameworkTemplate, config: EjectConfig): Record<string, unknown> {
    const pkg = { ...template.packageJson };
    const deps = { ...(pkg.dependencies as Record<string, string>) };
    const devDeps = { ...(pkg.devDependencies as Record<string, string>) };

    // Add feature dependencies
    if (config.features.includes('database')) {
      deps['@electric-sql/pglite'] = '^0.2.0';
      deps['drizzle-orm'] = '^0.30.0';
      devDeps['drizzle-kit'] = '^0.20.0';
    }

    if (config.features.includes('auth')) {
      deps['next-auth'] = '^5.0.0-beta';
    }

    if (config.features.includes('ai')) {
      deps['ai'] = '^3.0.0';
      deps['openai'] = '^4.0.0';
    }

    if (config.features.includes('realtime')) {
      deps['socket.io-client'] = '^4.7.0';
    }

    // Add user-specified dependencies
    for (const dep of config.dependencies) {
      if (dep.devOnly) {
        devDeps[dep.name] = dep.version;
      } else {
        deps[dep.name] = dep.version;
      }
    }

    // Add UI component libraries
    deps['@radix-ui/react-icons'] = '^1.3.0';
    deps['lucide-react'] = '^0.400.0';
    deps['clsx'] = '^2.1.0';
    deps['tailwind-merge'] = '^2.3.0';

    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;

    return pkg;
  }

  private generateAppEntry(framework: string): EjectFile {
    if (framework === 'nextjs') {
      return {
        path: 'app/page.tsx',
        content: `import { LiquidLayout } from '@/components/LiquidLayout';

export default function Home() {
  return <LiquidLayout />;
}
`,
        type: 'source',
      };
    }

    return {
      path: 'src/App.tsx',
      content: `import { LiquidLayout } from './components/LiquidLayout';

function App() {
  return <LiquidLayout />;
}

export default App;
`,
      type: 'source',
    };
  }

  private generateLayout(schema: LiquidSchema, framework: string): EjectFile {
    const basePath = framework === 'nextjs' ? 'components' : 'src/components';
    
    const layoutCode = `'use client';

import { useState, useEffect } from 'react';
import { useStore } from '../store';
${this.generateComponentImports(schema)}

export function LiquidLayout() {
  const store = useStore();

  return (
    <div className="min-h-screen bg-gray-50">
      ${this.generateLayoutJSX(schema.layout, '      ')}
    </div>
  );
}
`;

    return {
      path: `${basePath}/LiquidLayout.tsx`,
      content: layoutCode,
      type: 'source',
    };
  }

  private generateComponentImports(schema: LiquidSchema): string {
    const componentIds = this.collectComponentIds(schema.layout);
    const imports: string[] = [];

    for (const id of componentIds) {
      const comp = getComponent(id);
      if (comp) {
        imports.push(`import { ${comp.name} } from './${comp.name}';`);
      }
    }

    return imports.join('\n');
  }

  private collectComponentIds(node: any): Set<string> {
    const ids = new Set<string>();
    
    if (node.component) {
      ids.add(node.component);
    }

    if (node.children) {
      for (const child of node.children) {
        const childIds = this.collectComponentIds(child);
        childIds.forEach(id => ids.add(id));
      }
    }

    return ids;
  }

  private generateLayoutJSX(node: any, indent: string): string {
    if (node.type === 'component') {
      const comp = getComponent(node.component);
      if (!comp) return `{/* Unknown component: ${node.component} */}`;
      
      const propsStr = node.props 
        ? Object.entries(node.props).map(([k, v]) => `${k}={${JSON.stringify(v)}}`).join(' ')
        : '';
      
      return `<${comp.name} ${propsStr} />`;
    }

    if (node.type === 'split') {
      const direction = node.direction === 'horizontal' ? 'flex-row' : 'flex-col';
      const childrenJSX = node.children
        .map((child: any, i: number) => {
          const flex = node.sizes?.[i] ? `flex: ${node.sizes[i]}` : '';
          return `${indent}  <div style={{ ${flex} }}>
${indent}    ${this.generateLayoutJSX(child, indent + '    ')}
${indent}  </div>`;
        })
        .join('\n');

      return `<div className="flex ${direction} h-full">
${childrenJSX}
${indent}</div>`;
    }

    if (node.type === 'stack') {
      const childrenJSX = node.children
        .map((child: any) => `${indent}  ${this.generateLayoutJSX(child, indent + '  ')}`)
        .join('\n');

      return `<div className="flex flex-col gap-4">
${childrenJSX}
${indent}</div>`;
    }

    if (node.type === 'tabs') {
      return `<div className="tabs">
${indent}  {/* Tab implementation */}
${indent}</div>`;
    }

    return `{/* Layout node: ${node.type} */}`;
  }

  private generateComponentFiles(schema: LiquidSchema): EjectFile[] {
    const files: EjectFile[] = [];
    const componentIds = this.collectComponentIds(schema.layout);

    for (const id of componentIds) {
      const comp = getComponent(id);
      if (!comp) continue;

      const code = this.generateComponentCode(comp);
      files.push({
        path: `components/${comp.name}.tsx`,
        content: code,
        type: 'source',
      });
    }

    return files;
  }

  private generateComponentCode(comp: any): string {
    const propsInterface = this.generatePropsInterface(comp);
    
    return `'use client';

import { useState } from 'react';

${propsInterface}

export function ${comp.name}(props: ${comp.name}Props) {
  // Component implementation
  // Original Radiant component: ${comp.id}
  // Category: ${comp.category}
  
  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">${comp.icon}</span>
        <h3 className="font-semibold">${comp.name}</h3>
      </div>
      <div className="text-gray-500">
        {/* TODO: Implement ${comp.name} */}
        <p>${comp.description}</p>
      </div>
    </div>
  );
}
`;
  }

  private generatePropsInterface(comp: any): string {
    const props = comp.propsSchema?.properties || {};
    const propLines = Object.entries(props).map(([name, schema]: [string, any]) => {
      const type = this.schemaTypeToTS(schema);
      const optional = !comp.propsSchema?.required?.includes(name);
      return `  ${name}${optional ? '?' : ''}: ${type};`;
    });

    return `interface ${comp.name}Props {
${propLines.join('\n')}
}`;
  }

  private schemaTypeToTS(schema: any): string {
    switch (schema.type) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return 'unknown[]';
      case 'object': return 'Record<string, unknown>';
      default: return 'unknown';
    }
  }

  private generateTypesFile(schema: LiquidSchema): EjectFile {
    return {
      path: 'types/index.ts',
      content: `// Generated types from Radiant Liquid Interface

export interface LiquidState {
  mode: 'chat' | 'morphed' | 'transitioning';
  data: Record<string, unknown>;
  selection: unknown | null;
  lastUpdated: string;
}

export interface GhostBinding {
  id: string;
  sourceComponent: string;
  sourceProperty: string;
  contextKey: string;
  direction: 'ui_to_ai' | 'ai_to_ui' | 'bidirectional';
}

// Schema-specific types
${JSON.stringify(schema.bindings, null, 2)
  .split('\n')
  .map(line => `// ${line}`)
  .join('\n')}
`,
      type: 'source',
    };
  }

  private generateStateStore(schema: LiquidSchema): EjectFile {
    const initialState: Record<string, unknown> = {};
    for (const binding of schema.bindings) {
      initialState[binding.contextKey] = schema.initialData[binding.contextKey] ?? null;
    }

    return {
      path: 'store/index.ts',
      content: `import { create } from 'zustand';

interface StoreState {
  // State values
${Object.keys(initialState).map(k => `  ${k}: unknown;`).join('\n')}
  
  // Actions
  setValue: (key: string, value: unknown) => void;
  reset: () => void;
}

const initialState = ${JSON.stringify(initialState, null, 2)};

export const useStore = create<StoreState>((set) => ({
  ...initialState,
  
  setValue: (key, value) => set((state) => ({ ...state, [key]: value })),
  reset: () => set(initialState),
}));
`,
      type: 'source',
    };
  }

  private generateDatabaseFiles(session: LiquidSession): EjectFile[] {
    return [
      {
        path: 'lib/db.ts',
        content: `import { PGlite } from '@electric-sql/pglite';

let db: PGlite | null = null;

export async function getDb() {
  if (!db) {
    db = new PGlite('idb://liquid-app');
    await initSchema(db);
  }
  return db;
}

async function initSchema(db: PGlite) {
  // Initialize your schema here
  await db.exec(\`
    CREATE TABLE IF NOT EXISTS app_data (
      id TEXT PRIMARY KEY,
      data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  \`);
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const result = await db.query(sql, params);
  return result.rows as T[];
}
`,
        type: 'source',
      },
      {
        path: 'lib/migrations/001_initial.sql',
        content: `-- Initial schema migration
-- Generated from Radiant Liquid Interface

CREATE TABLE IF NOT EXISTS app_data (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_data_created ON app_data(created_at);
`,
        type: 'source',
      },
    ];
  }

  private generateAPIFiles(framework: string): EjectFile[] {
    if (framework === 'nextjs') {
      return [
        {
          path: 'app/api/data/route.ts',
          content: `import { NextResponse } from 'next/server';

export async function GET() {
  // Fetch data
  return NextResponse.json({ data: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  // Save data
  return NextResponse.json({ success: true, data: body });
}
`,
          type: 'source',
        },
      ];
    }

    return [];
  }

  private generateAIIntegrationFiles(): EjectFile[] {
    return [
      {
        path: 'lib/ai.ts',
        content: `import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chat(messages: Array<{ role: string; content: string }>) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: messages as any,
  });

  return response.choices[0].message.content;
}

export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void
) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: messages as any,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      onChunk(content);
    }
  }
}
`,
        type: 'source',
      },
    ];
  }

  private generateReadme(config: EjectConfig): EjectFile {
    const featureList = config.features.map(f => `- ${f}`).join('\n');

    return {
      path: 'README.md',
      content: `# Liquid App

This application was generated by **Radiant Liquid Interface**.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Copy \`.env.example\` to \`.env.local\` and fill in your values.

3. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Features

${featureList}

## Tech Stack

- Framework: ${config.framework}
- Styling: Tailwind CSS
- State: Zustand
${config.features.includes('database') ? '- Database: PGLite (SQLite-compatible in browser)' : ''}
${config.features.includes('ai') ? '- AI: OpenAI GPT-4' : ''}

## Generated by Radiant

This app was created using [Radiant Think Tank](https://radiant.ai)'s Liquid Interface.
The chat morphed into this tool based on your intent.

---
Built with ❤️ by Radiant
`,
      type: 'doc',
    };
  }

  private generateSetupInstructions(config: EjectConfig): string[] {
    const instructions: string[] = [
      '1. Extract the files to a new directory',
      '2. Run `npm install` to install dependencies',
      '3. Copy `.env.example` to `.env.local`',
    ];

    if (config.secrets.length > 0) {
      instructions.push('4. Fill in the required environment variables:');
      for (const secret of config.secrets) {
        instructions.push(`   - ${secret.envKey}: ${secret.description}`);
      }
    }

    instructions.push(`${instructions.length + 1}. Run \`npm run dev\` to start the development server`);

    return instructions;
  }

  private generateEnvExample(secrets: EjectSecret[]): string {
    const lines = ['# Environment Variables', '# Generated by Radiant Liquid Interface', ''];

    for (const secret of secrets) {
      lines.push(`# ${secret.description}`);
      lines.push(`${secret.envKey}=`);
      lines.push('');
    }

    // Add common vars
    lines.push('# Common Variables');
    lines.push('NODE_ENV=development');
    lines.push('');

    return lines.join('\n');
  }

  private generateWarnings(schema: LiquidSchema, config: EjectConfig): string[] {
    const warnings: string[] = [];

    if (config.features.includes('database') && !config.features.includes('api')) {
      warnings.push('Database feature enabled but no API routes - data will be client-side only');
    }

    if (config.features.includes('ai') && config.secrets.every(s => s.envKey !== 'OPENAI_API_KEY')) {
      warnings.push('AI feature enabled but OPENAI_API_KEY not in secrets - add it to .env');
    }

    const componentIds = this.collectComponentIds(schema.layout);
    for (const id of componentIds) {
      if (!getComponent(id)) {
        warnings.push(`Unknown component "${id}" - will generate placeholder`);
      }
    }

    return warnings;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async getSession(sessionId: string): Promise<LiquidSession | null> {
    const result = await executeStatement(
      `SELECT * FROM liquid_sessions WHERE id = :sessionId`,
      [stringParam('sessionId', sessionId)]
    );

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        userId: String(row.user_id),
        mode: String(row.mode) as any,
        currentSchema: this.parseJson(row.current_schema) ?? undefined,
        ghostState: this.parseJson(row.ghost_state) || {},
        eventHistory: [],
        reactionHistory: [],
        conversationId: String(row.conversation_id),
        messageCount: Number(row.message_count) || 0,
        createdAt: String(row.created_at),
        lastActivityAt: String(row.last_activity_at),
        morphedAt: row.morphed_at ? String(row.morphed_at) : undefined,
      };
    }

    return null;
  }

  private async recordEject(sessionId: string, config: EjectConfig, fileCount: number): Promise<void> {
    await executeStatement(
      `INSERT INTO liquid_eject_history (id, session_id, framework, features, file_count, created_at)
        VALUES (:id, :sessionId, :framework, :features, :fileCount, NOW())`,
      [
        stringParam('id', `eject_${Date.now()}`),
        stringParam('sessionId', sessionId),
        stringParam('framework', config.framework),
        stringParam('features', JSON.stringify(config.features)),
        stringParam('fileCount', String(fileCount)),
      ]
    );
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

const GITIGNORE_CONTENT = `# Dependencies
node_modules
.pnp
.pnp.js

# Build
.next
out
build
dist

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# TypeScript
*.tsbuildinfo

# Database
*.db
*.sqlite
`;

export const ejectService = new EjectService();
