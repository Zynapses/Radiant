-- RADIANT v5.52.30 - Shadow Learning Sources
-- Stores curated exercise sources for self-training on public data

-- ============================================================================
-- SHADOW LEARNING SOURCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS shadow_learning_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('github', 'documentation', 'stackoverflow')),
  source_url TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  difficulty_level VARCHAR(20) DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'expert')),
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  avg_grade DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_url)
);

CREATE INDEX idx_shadow_learning_sources_type ON shadow_learning_sources(source_type);
CREATE INDEX idx_shadow_learning_sources_active ON shadow_learning_sources(is_active) WHERE is_active = true;
CREATE INDEX idx_shadow_learning_sources_metadata ON shadow_learning_sources USING GIN(metadata);
CREATE INDEX idx_shadow_learning_sources_tags ON shadow_learning_sources USING GIN(tags);
CREATE INDEX idx_shadow_learning_sources_difficulty ON shadow_learning_sources(difficulty_level);

-- Trigger for updated_at
CREATE TRIGGER trigger_shadow_learning_sources_updated
  BEFORE UPDATE ON shadow_learning_sources
  FOR EACH ROW EXECUTE FUNCTION update_enhanced_learning_timestamp();

-- ============================================================================
-- SEED SOME INITIAL EXERCISES
-- ============================================================================

INSERT INTO shadow_learning_sources (source_type, source_url, content, metadata, tags, difficulty_level) VALUES
-- TypeScript documentation exercises
('documentation', 'https://www.typescriptlang.org/docs/handbook/2/types-from-types.html', 
 'Given a User type with name: string, age: number, email: string, create a type that makes all properties optional.',
 '{"library": "typescript", "topic": "utility_types", "expected_answer": "type PartialUser = Partial<User>;"}',
 ARRAY['typescript', 'types', 'utility-types'],
 'easy'),

('documentation', 'https://www.typescriptlang.org/docs/handbook/2/generics.html',
 'Create a generic function that takes an array of any type and returns the first element, preserving the type.',
 '{"library": "typescript", "topic": "generics", "expected_answer": "function first<T>(arr: T[]): T | undefined { return arr[0]; }"}',
 ARRAY['typescript', 'generics', 'functions'],
 'medium'),

('documentation', 'https://www.typescriptlang.org/docs/handbook/2/conditional-types.html',
 'Create a conditional type that extracts the return type of a function type.',
 '{"library": "typescript", "topic": "conditional_types", "expected_answer": "type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;"}',
 ARRAY['typescript', 'conditional-types', 'advanced'],
 'hard'),

-- React documentation exercises  
('documentation', 'https://react.dev/reference/react/useState',
 'Create a counter component using useState that increments on button click.',
 '{"library": "react", "topic": "hooks", "expected_answer": "function Counter() { const [count, setCount] = useState(0); return <button onClick={() => setCount(c => c + 1)}>{count}</button>; }"}',
 ARRAY['react', 'hooks', 'useState'],
 'easy'),

('documentation', 'https://react.dev/reference/react/useEffect',
 'Create a component that fetches data from an API on mount and displays loading state.',
 '{"library": "react", "topic": "hooks", "expected_answer": "function DataFetcher({ url }) { const [data, setData] = useState(null); const [loading, setLoading] = useState(true); useEffect(() => { fetch(url).then(r => r.json()).then(d => { setData(d); setLoading(false); }); }, [url]); if (loading) return <div>Loading...</div>; return <div>{JSON.stringify(data)}</div>; }"}',
 ARRAY['react', 'hooks', 'useEffect', 'data-fetching'],
 'medium'),

-- GitHub code examples
('github', 'https://github.com/microsoft/TypeScript/blob/main/src/compiler/types.ts',
 'Implement a function that checks if a TypeScript node is a function declaration.',
 '{"language": "typescript", "repo": "microsoft/TypeScript", "topic": "ast"}',
 ARRAY['typescript', 'compiler', 'ast'],
 'expert'),

('github', 'https://github.com/facebook/react/blob/main/packages/react/src/ReactHooks.js',
 'Implement a basic custom hook that manages form input state.',
 '{"language": "javascript", "repo": "facebook/react", "topic": "hooks"}',
 ARRAY['react', 'hooks', 'custom-hooks'],
 'medium'),

-- StackOverflow Q&A pairs
('stackoverflow', 'https://stackoverflow.com/questions/12345/typescript-extend-interface',
 'How do you extend an interface in TypeScript to add new properties while keeping the original ones?',
 '{"tags": "typescript,interface,extends", "score": 250, "expected_answer": "interface Extended extends Original { newProp: string; }"}',
 ARRAY['typescript', 'interface', 'inheritance'],
 'easy'),

('stackoverflow', 'https://stackoverflow.com/questions/67890/react-memo-vs-usememo',
 'What is the difference between React.memo and useMemo, and when should you use each?',
 '{"tags": "react,performance,memoization", "score": 180, "expected_answer": "React.memo is for memoizing components to prevent re-renders when props havent changed. useMemo is for memoizing expensive computations within a component."}',
 ARRAY['react', 'performance', 'memoization'],
 'medium')

ON CONFLICT (source_type, source_url) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE shadow_learning_sources IS 'Curated exercise sources for AI self-training during idle periods';
COMMENT ON COLUMN shadow_learning_sources.content IS 'The challenge/question to solve';
COMMENT ON COLUMN shadow_learning_sources.metadata IS 'Source-specific metadata including expected answers';
COMMENT ON COLUMN shadow_learning_sources.usage_count IS 'Number of times this exercise has been used';
COMMENT ON COLUMN shadow_learning_sources.avg_grade IS 'Average self-grading score for this exercise';
