import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cato Brand Colors — cool teal/cyan intelligence palette
        cato: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        // Ground-truth accent — emerald for verified citations
        ground: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // RADIANT shared — Omega accent for platform continuity
        omega: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        // Citation confidence tiers
        citation: {
          exact: '#10b981',
          high: '#22d3ee',
          moderate: '#f59e0b',
          low: '#ef4444',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        serif: ['"Lora"', '"Georgia"', 'serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'cato-glow': 'cato-glow 2s ease-in-out infinite alternate',
        'cite-flash': 'cite-flash 0.4s ease-out',
        'search-ripple': 'search-ripple 0.6s ease-out',
        'doc-reveal': 'doc-reveal 0.35s ease-out',
        'typing-dots': 'typing-dots 1.2s infinite',
      },
      keyframes: {
        'cato-glow': {
          '0%': { boxShadow: '0 0 5px theme("colors.cato.500"), 0 0 20px theme("colors.cato.500")' },
          '100%': { boxShadow: '0 0 10px theme("colors.cato.400"), 0 0 40px theme("colors.cato.400")' },
        },
        'cite-flash': {
          '0%': { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'search-ripple': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'doc-reveal': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'typing-dots': {
          '0%, 20%': { opacity: '0.2' },
          '50%': { opacity: '1' },
          '80%, 100%': { opacity: '0.2' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
