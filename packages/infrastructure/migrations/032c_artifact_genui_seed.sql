-- ============================================================================
-- RADIANT Artifact Engine - Seed Data
-- Migration: 032c_artifact_genui_seed.sql
-- Version: 4.19.0
-- Depends On: 032b_artifact_genui_engine.sql
-- 
-- Seeds default validation rules and dependency allowlist.
-- ============================================================================

-- ============================================================================
-- DEFAULT VALIDATION RULES (Cato CBFs)
-- ============================================================================

INSERT INTO artifact_validation_rules (rule_name, rule_type, description, validation_pattern, severity, error_message)
VALUES
    -- Injection Prevention
    ('no_eval', 'injection_prevention', 
     'Prevent eval() and Function() constructor - primary code injection vectors', 
     'eval\s*\(|new\s+Function\s*\(', 'block', 
     'Code injection via eval() or Function() is not allowed'),
    
    ('no_document_write', 'injection_prevention', 
     'Prevent document.write - DOM manipulation vulnerability', 
     'document\.write', 'block', 
     'document.write() is not allowed'),
    
    ('no_innerhtml_xss', 'injection_prevention', 
     'Warn on innerHTML usage - potential XSS if unsanitized', 
     'innerHTML\s*=', 'warn', 
     'innerHTML usage detected. Ensure proper sanitization.'),
    
    ('no_dynamic_script', 'injection_prevention',
     'Prevent dynamic script creation',
     'createElement\s*\(\s*[''"]script[''"]', 'block',
     'Dynamic script creation is not allowed'),
    
    -- API Restrictions
    ('no_external_fetch', 'api_restriction', 
     'Prevent fetch to external domains - data exfiltration risk', 
     'fetch\s*\(\s*[''"`]https?://(?!api\.radiant\.)', 'block', 
     'External API calls are not allowed. Use RADIANT APIs only.'),
    
    ('no_localstorage', 'api_restriction', 
     'Prevent localStorage/sessionStorage - data persistence risk', 
     'localStorage|sessionStorage', 'block', 
     'Browser storage access is not allowed in artifacts'),
    
    ('no_window_location', 'api_restriction',
     'Prevent navigation manipulation - redirect attacks',
     'window\.location|document\.location', 'block',
     'Navigation manipulation is not allowed in artifacts'),
    
    ('no_cookies', 'api_restriction',
     'Prevent cookie access - session hijacking risk',
     'document\.cookie', 'block',
     'Cookie access is not allowed in artifacts'),
    
    ('no_indexeddb', 'api_restriction',
     'Prevent IndexedDB access - persistent storage risk',
     'indexedDB|IDBDatabase', 'block',
     'IndexedDB access is not allowed in artifacts'),
    
    ('no_websocket', 'api_restriction',
     'Prevent WebSocket connections - unauthorized network access',
     'new\s+WebSocket', 'block',
     'WebSocket connections are not allowed in artifacts'),
    
    -- Resource Limits
    ('max_lines', 'resource_limit', 
     'Limit artifact size to 500 lines - prevents excessive complexity', 
     NULL, 'block', 
     'Artifact exceeds maximum allowed size of 500 lines'),
    
    -- Dependency Check
    ('allowed_imports', 'dependency_check', 
     'Only allow whitelisted imports - supply chain security', 
     NULL, 'block', 
     'Import not in allowed dependencies list');

-- ============================================================================
-- DEFAULT DEPENDENCY ALLOWLIST
-- ============================================================================

INSERT INTO artifact_dependency_allowlist (tenant_id, package_name, reason, security_reviewed)
VALUES
    -- Core React
    (NULL, 'react', 'Core React library - required for all components', TRUE),
    
    -- Icons
    (NULL, 'lucide-react', 'Icon library - safe SVG rendering only', TRUE),
    (NULL, '@radix-ui/react-icons', 'Radix icons - safe SVG rendering', TRUE),
    
    -- Charting
    (NULL, 'recharts', 'Charting library - client-side only, no external calls', TRUE),
    (NULL, 'chart.js', 'Canvas-based charting - no network access', TRUE),
    (NULL, 'd3', 'Data visualization - computational only', TRUE),
    
    -- Math & Data
    (NULL, 'mathjs', 'Math operations - pure computational library', TRUE),
    (NULL, 'lodash', 'Utility library - pure functions only', TRUE),
    (NULL, 'date-fns', 'Date utilities - no side effects', TRUE),
    (NULL, 'papaparse', 'CSV parsing - client-side only', TRUE),
    
    -- Animation
    (NULL, 'framer-motion', 'Animation library - CSS/JS transforms only', TRUE),
    
    -- State Management
    (NULL, 'zustand', 'State management - in-memory only', TRUE),
    (NULL, 'immer', 'Immutable state helpers - pure functions', TRUE),
    
    -- 3D/Graphics
    (NULL, 'three', '3D graphics - WebGL rendering only', TRUE),
    
    -- Audio
    (NULL, 'tone', 'Audio synthesis - Web Audio API only', TRUE),
    
    -- UI Components (shadcn/ui dependencies)
    (NULL, '@radix-ui/react-slot', 'Radix primitive - safe component composition', TRUE),
    (NULL, '@radix-ui/react-dialog', 'Radix dialog - accessible modal', TRUE),
    (NULL, '@radix-ui/react-dropdown-menu', 'Radix dropdown - accessible menu', TRUE),
    (NULL, '@radix-ui/react-tabs', 'Radix tabs - accessible tab panel', TRUE),
    (NULL, '@radix-ui/react-tooltip', 'Radix tooltip - accessible tooltip', TRUE),
    (NULL, 'class-variance-authority', 'CVA - CSS class utilities', TRUE),
    (NULL, 'clsx', 'Class name utility - pure function', TRUE),
    (NULL, 'tailwind-merge', 'Tailwind class merging - pure function', TRUE);

-- ============================================================================
-- DEFAULT CODE PATTERNS
-- ============================================================================

INSERT INTO artifact_code_patterns (pattern_name, pattern_type, description, template_code, dependencies, scope)
VALUES
    ('Basic Calculator', 'calculator', 
     'Simple calculator with arithmetic operations and clean UI',
     E'import React, { useState } from ''react'';\nimport { Calculator } from ''lucide-react'';\n\nexport default function BasicCalculator() {\n  const [display, setDisplay] = useState(''0'');\n  const [equation, setEquation] = useState('''');\n  const [hasResult, setHasResult] = useState(false);\n\n  const handleNumber = (num: string) => {\n    if (hasResult) {\n      setDisplay(num);\n      setHasResult(false);\n    } else {\n      setDisplay(prev => prev === ''0'' ? num : prev + num);\n    }\n  };\n\n  const handleOperator = (op: string) => {\n    setEquation(display + '' '' + op + '' '');\n    setDisplay(''0'');\n    setHasResult(false);\n  };\n\n  const calculate = () => {\n    try {\n      const expr = equation + display;\n      const sanitized = expr.replace(/[^0-9+\\-*/().\\s]/g, '''');\n      const result = Function(''return '' + sanitized)();\n      setDisplay(String(Number(result.toFixed(8))));\n      setEquation('''');\n      setHasResult(true);\n    } catch {\n      setDisplay(''Error'');\n    }\n  };\n\n  const clear = () => {\n    setDisplay(''0'');\n    setEquation('''');\n    setHasResult(false);\n  };\n\n  const buttons = [''7'',''8'',''9'',''/'',''4'',''5'',''6'',''*'',''1'',''2'',''3'',''-'',''0'',''.'',''='',''+'']\n\n  return (\n    <div className=\"p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-lg max-w-xs mx-auto\">\n      <div className=\"flex items-center gap-2 mb-4\">\n        <Calculator className=\"w-5 h-5 text-blue-600\" />\n        <h2 className=\"font-semibold text-gray-800\">Calculator</h2>\n      </div>\n      <div className=\"bg-white p-4 rounded-lg mb-4 shadow-inner\">\n        <div className=\"text-gray-400 text-sm h-5 font-mono\">{equation}</div>\n        <div className=\"text-3xl font-mono text-right text-gray-800 truncate\">{display}</div>\n      </div>\n      <div className=\"grid grid-cols-4 gap-2\">\n        {buttons.map(btn => (\n          <button\n            key={btn}\n            onClick={() => {\n              if (btn === ''='') calculate();\n              else if ([''+'',' '-'',''*'',''/''].includes(btn)) handleOperator(btn);\n              else handleNumber(btn);\n            }}\n            className={`p-4 rounded-lg font-semibold transition-all\n              ${[''+'',' '-'',''*'',''/''].includes(btn) \n                ? ''bg-blue-500 text-white hover:bg-blue-600'' \n                : btn === ''='' \n                  ? ''bg-green-500 text-white hover:bg-green-600''\n                  : ''bg-white text-gray-800 hover:bg-gray-50 shadow''}`}\n          >\n            {btn}\n          </button>\n        ))}\n        <button \n          onClick={clear} \n          className=\"col-span-4 p-3 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-all\"\n        >\n          Clear\n        </button>\n      </div>\n    </div>\n  );\n}',
     '["lucide-react"]',
     'system'),

    ('Line Chart', 'chart', 
     'Responsive line chart with multiple series using Recharts',
     E'import React from ''react'';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from ''recharts'';\n\nconst data = [\n  { name: ''Jan'', value: 400, secondary: 240 },\n  { name: ''Feb'', value: 300, secondary: 139 },\n  { name: ''Mar'', value: 600, secondary: 380 },\n  { name: ''Apr'', value: 800, secondary: 490 },\n  { name: ''May'', value: 500, secondary: 380 },\n  { name: ''Jun'', value: 700, secondary: 430 },\n];\n\nexport default function BasicLineChart() {\n  return (\n    <div className=\"w-full p-6 bg-white rounded-xl shadow-lg\">\n      <h2 className=\"text-lg font-semibold text-gray-800 mb-4\">Monthly Trends</h2>\n      <div className=\"h-64\">\n        <ResponsiveContainer width=\"100%\" height=\"100%\">\n          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>\n            <CartesianGrid strokeDasharray=\"3 3\" stroke=\"#f0f0f0\" />\n            <XAxis dataKey=\"name\" stroke=\"#888\" fontSize={12} />\n            <YAxis stroke=\"#888\" fontSize={12} />\n            <Tooltip \n              contentStyle={{ \n                backgroundColor: ''#fff'', \n                border: ''1px solid #e0e0e0'',\n                borderRadius: ''8px'',\n                boxShadow: ''0 2px 8px rgba(0,0,0,0.1)''\n              }} \n            />\n            <Legend />\n            <Line \n              type=\"monotone\" \n              dataKey=\"value\" \n              stroke=\"#3b82f6\" \n              strokeWidth={2}\n              dot={{ fill: ''#3b82f6'', strokeWidth: 2 }}\n              activeDot={{ r: 6 }}\n              name=\"Primary\"\n            />\n            <Line \n              type=\"monotone\" \n              dataKey=\"secondary\" \n              stroke=\"#10b981\" \n              strokeWidth={2}\n              dot={{ fill: ''#10b981'', strokeWidth: 2 }}\n              name=\"Secondary\"\n            />\n          </LineChart>\n        </ResponsiveContainer>\n      </div>\n    </div>\n  );\n}',
     '["recharts"]',
     'system'),

    ('Contact Form', 'form',
     'Accessible form with validation and success state',
     E'import React, { useState } from ''react'';\nimport { Send, CheckCircle, AlertCircle } from ''lucide-react'';\n\ninterface FormData {\n  name: string;\n  email: string;\n  message: string;\n}\n\ninterface FormErrors {\n  name?: string;\n  email?: string;\n  message?: string;\n}\n\nexport default function ContactForm() {\n  const [formData, setFormData] = useState<FormData>({ name: '''', email: '''', message: '''' });\n  const [errors, setErrors] = useState<FormErrors>({});\n  const [submitted, setSubmitted] = useState(false);\n\n  const validate = (): boolean => {\n    const newErrors: FormErrors = {};\n    if (!formData.name.trim()) newErrors.name = ''Name is required'';\n    if (!formData.email.trim()) newErrors.email = ''Email is required'';\n    else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.email)) {\n      newErrors.email = ''Invalid email format'';\n    }\n    if (!formData.message.trim()) newErrors.message = ''Message is required'';\n    setErrors(newErrors);\n    return Object.keys(newErrors).length === 0;\n  };\n\n  const handleSubmit = (e: React.FormEvent) => {\n    e.preventDefault();\n    if (validate()) setSubmitted(true);\n  };\n\n  if (submitted) {\n    return (\n      <div className=\"p-8 bg-green-50 rounded-xl text-center max-w-md mx-auto\">\n        <CheckCircle className=\"w-16 h-16 text-green-500 mx-auto mb-4\" />\n        <h2 className=\"text-xl font-semibold text-green-800\">Thank You!</h2>\n        <p className=\"text-green-600 mt-2\">Your message has been received.</p>\n        <button \n          onClick={() => { setSubmitted(false); setFormData({ name: '''', email: '''', message: '''' }); }}\n          className=\"mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600\"\n        >\n          Send Another\n        </button>\n      </div>\n    );\n  }\n\n  return (\n    <div className=\"p-6 bg-white rounded-xl shadow-lg max-w-md mx-auto\">\n      <h2 className=\"text-xl font-semibold text-gray-800 mb-6\">Contact Us</h2>\n      <form onSubmit={handleSubmit} className=\"space-y-4\">\n        <div>\n          <label htmlFor=\"name\" className=\"block text-sm font-medium text-gray-700 mb-1\">Name</label>\n          <input\n            id=\"name\"\n            type=\"text\"\n            value={formData.name}\n            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}\n            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none\n              ${errors.name ? ''border-red-500'' : ''border-gray-300''}`}\n            aria-invalid={!!errors.name}\n          />\n          {errors.name && <p className=\"mt-1 text-sm text-red-500 flex items-center gap-1\">\n            <AlertCircle className=\"w-4 h-4\" />{errors.name}\n          </p>}\n        </div>\n        <div>\n          <label htmlFor=\"email\" className=\"block text-sm font-medium text-gray-700 mb-1\">Email</label>\n          <input\n            id=\"email\"\n            type=\"email\"\n            value={formData.email}\n            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}\n            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none\n              ${errors.email ? ''border-red-500'' : ''border-gray-300''}`}\n            aria-invalid={!!errors.email}\n          />\n          {errors.email && <p className=\"mt-1 text-sm text-red-500 flex items-center gap-1\">\n            <AlertCircle className=\"w-4 h-4\" />{errors.email}\n          </p>}\n        </div>\n        <div>\n          <label htmlFor=\"message\" className=\"block text-sm font-medium text-gray-700 mb-1\">Message</label>\n          <textarea\n            id=\"message\"\n            rows={4}\n            value={formData.message}\n            onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}\n            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none\n              ${errors.message ? ''border-red-500'' : ''border-gray-300''}`}\n            aria-invalid={!!errors.message}\n          />\n          {errors.message && <p className=\"mt-1 text-sm text-red-500 flex items-center gap-1\">\n            <AlertCircle className=\"w-4 h-4\" />{errors.message}\n          </p>}\n        </div>\n        <button\n          type=\"submit\"\n          className=\"w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 \n                     transition-all flex items-center justify-center gap-2\"\n        >\n          <Send className=\"w-4 h-4\" />\n          Send Message\n        </button>\n      </form>\n    </div>\n  );\n}',
     '["lucide-react"]',
     'system'),

    ('Data Table', 'table',
     'Sortable and paginated data table',
     E'import React, { useState, useMemo } from ''react'';\nimport { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from ''lucide-react'';\n\ninterface DataRow {\n  id: number;\n  name: string;\n  email: string;\n  status: ''active'' | ''inactive'' | ''pending'';\n  joined: string;\n}\n\nconst initialData: DataRow[] = [\n  { id: 1, name: ''Alice Johnson'', email: ''alice@example.com'', status: ''active'', joined: ''2024-01-15'' },\n  { id: 2, name: ''Bob Smith'', email: ''bob@example.com'', status: ''inactive'', joined: ''2024-02-20'' },\n  { id: 3, name: ''Carol White'', email: ''carol@example.com'', status: ''active'', joined: ''2024-03-10'' },\n  { id: 4, name: ''David Brown'', email: ''david@example.com'', status: ''pending'', joined: ''2024-04-05'' },\n  { id: 5, name: ''Eve Davis'', email: ''eve@example.com'', status: ''active'', joined: ''2024-05-12'' },\n  { id: 6, name: ''Frank Miller'', email: ''frank@example.com'', status: ''inactive'', joined: ''2024-06-18'' },\n];\n\ntype SortKey = keyof DataRow;\ntype SortOrder = ''asc'' | ''desc'';\n\nexport default function DataTable() {\n  const [data] = useState<DataRow[]>(initialData);\n  const [sortKey, setSortKey] = useState<SortKey>(''id'');\n  const [sortOrder, setSortOrder] = useState<SortOrder>(''asc'');\n  const [page, setPage] = useState(1);\n  const pageSize = 3;\n\n  const sortedData = useMemo(() => {\n    return [...data].sort((a, b) => {\n      const aVal = a[sortKey];\n      const bVal = b[sortKey];\n      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;\n      return sortOrder === ''asc'' ? cmp : -cmp;\n    });\n  }, [data, sortKey, sortOrder]);\n\n  const paginatedData = useMemo(() => {\n    const start = (page - 1) * pageSize;\n    return sortedData.slice(start, start + pageSize);\n  }, [sortedData, page]);\n\n  const totalPages = Math.ceil(data.length / pageSize);\n\n  const handleSort = (key: SortKey) => {\n    if (sortKey === key) {\n      setSortOrder(prev => prev === ''asc'' ? ''desc'' : ''asc'');\n    } else {\n      setSortKey(key);\n      setSortOrder(''asc'');\n    }\n  };\n\n  const SortIcon = ({ column }: { column: SortKey }) => {\n    if (sortKey !== column) return null;\n    return sortOrder === ''asc'' ? <ChevronUp className=\"w-4 h-4\" /> : <ChevronDown className=\"w-4 h-4\" />;\n  };\n\n  const statusColors = {\n    active: ''bg-green-100 text-green-800'',\n    inactive: ''bg-gray-100 text-gray-800'',\n    pending: ''bg-yellow-100 text-yellow-800'',\n  };\n\n  return (\n    <div className=\"p-6 bg-white rounded-xl shadow-lg\">\n      <h2 className=\"text-xl font-semibold text-gray-800 mb-4\">Users</h2>\n      <div className=\"overflow-x-auto\">\n        <table className=\"w-full\">\n          <thead>\n            <tr className=\"border-b\">\n              {([''name'', ''email'', ''status'', ''joined''] as SortKey[]).map(col => (\n                <th key={col} className=\"text-left p-3\">\n                  <button \n                    onClick={() => handleSort(col)}\n                    className=\"flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900\"\n                  >\n                    {col.charAt(0).toUpperCase() + col.slice(1)}\n                    <SortIcon column={col} />\n                  </button>\n                </th>\n              ))}\n            </tr>\n          </thead>\n          <tbody>\n            {paginatedData.map(row => (\n              <tr key={row.id} className=\"border-b hover:bg-gray-50\">\n                <td className=\"p-3 font-medium\">{row.name}</td>\n                <td className=\"p-3 text-gray-600\">{row.email}</td>\n                <td className=\"p-3\">\n                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[row.status]}`}>\n                    {row.status}\n                  </span>\n                </td>\n                <td className=\"p-3 text-gray-600\">{row.joined}</td>\n              </tr>\n            ))}\n          </tbody>\n        </table>\n      </div>\n      <div className=\"flex items-center justify-between mt-4 pt-4 border-t\">\n        <span className=\"text-sm text-gray-600\">Page {page} of {totalPages}</span>\n        <div className=\"flex gap-2\">\n          <button\n            onClick={() => setPage(p => Math.max(1, p - 1))}\n            disabled={page === 1}\n            className=\"p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed\"\n          >\n            <ChevronLeft className=\"w-4 h-4\" />\n          </button>\n          <button\n            onClick={() => setPage(p => Math.min(totalPages, p + 1))}\n            disabled={page === totalPages}\n            className=\"p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed\"\n          >\n            <ChevronRight className=\"w-4 h-4\" />\n          </button>\n        </div>\n      </div>\n    </div>\n  );\n}',
     '["lucide-react"]',
     'system');
