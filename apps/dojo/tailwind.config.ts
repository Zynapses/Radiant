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
        // Dojo Brand Colors — warm gold/amber discipline palette
        dojo: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
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
        // Mastery Rank Colors
        rank: {
          novice: '#94a3b8',     // Slate — White Belt
          initiate: '#22c55e',   // Green — Developing
          adept: '#3b82f6',      // Blue — Competent
          master: '#a855f7',     // Purple — Advanced
          radiant: '#f59e0b',    // Gold — Mastery
        },
        // Sparring Result Colors
        sparring: {
          correct: '#22c55e',
          partial: '#eab308',
          incorrect: '#ef4444',
          unanswered: '#64748b',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'dojo-glow 2s ease-in-out infinite alternate',
        'rank-up': 'rank-up 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'theme-reveal': 'theme-reveal 0.6s ease-out',
        'spar-flash': 'spar-flash 0.3s ease-in-out',
      },
      keyframes: {
        'dojo-glow': {
          '0%': { boxShadow: '0 0 5px theme("colors.dojo.500"), 0 0 20px theme("colors.dojo.500")' },
          '100%': { boxShadow: '0 0 10px theme("colors.dojo.400"), 0 0 40px theme("colors.dojo.400")' },
        },
        'rank-up': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'theme-reveal': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'spar-flash': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5', transform: 'scale(1.02)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
