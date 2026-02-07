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
        // OMEGA Brand Colors
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
        // Neural Activity Colors
        neural: {
          warm: '#ef4444',
          cooling: '#f97316',
          cold: '#3b82f6',
          frozen: '#6366f1',
        },
        // Coherence Gradient
        coherence: {
          low: '#ef4444',
          medium: '#eab308',
          high: '#22c55e',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'spin-gear': 'spin 3s linear infinite',
        'reactor-charge': 'reactor-charge 1.5s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px theme("colors.omega.500"), 0 0 20px theme("colors.omega.500")' },
          '100%': { boxShadow: '0 0 10px theme("colors.omega.400"), 0 0 40px theme("colors.omega.400")' },
        },
        'reactor-charge': {
          '0%': { boxShadow: '0 0 10px rgba(56,189,248,0.1)' },
          '100%': { boxShadow: '0 0 60px rgba(255,255,255,0.6), 0 0 120px rgba(56,189,248,0.3)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
