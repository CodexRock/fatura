import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary — Ocean Blue (full scale)
        primary: {
          DEFAULT: '#1B4965',
          50:  '#EFF6FB',
          100: '#D6EAF5',
          200: '#ACD5EB',
          300: '#7BBFDE',
          400: '#5FA8D3',
          500: '#3B8CB9',
          600: '#2A6F99',
          700: '#1B4965',
          800: '#133651',
          900: '#0C2438',
          950: '#071624',
        },
        // Accent — Warm Amber (full scale)
        accent: {
          DEFAULT: '#F4A261',
          50:  '#FFF8F0',
          100: '#FEECD8',
          200: '#FDD9B1',
          300: '#FBBF80',
          400: '#F9A057',
          500: '#F4A261',
          600: '#E07D35',
          700: '#C4621F',
          800: '#9D4C18',
          900: '#7B3C16',
        },
        // Success — Forest Green
        success: {
          DEFAULT: '#2D6A4F',
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#2D6A4F',
          600: '#1A5E3F',
          700: '#144D33',
        },
        // Danger — Coral Red
        danger: {
          DEFAULT: '#E63946',
          50:  '#FFF5F5',
          100: '#FECACA',
          200: '#FCA5A5',
          300: '#F87171',
          400: '#EF4444',
          500: '#E63946',
          600: '#C0313D',
          700: '#9B2335',
        },
        // Keep secondary as alias for primary-400
        secondary: '#5FA8D3',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        arabic: ['"Noto Kufi Arabic"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 20px rgba(27,73,101,0.08)',
        'modal': '0 8px 40px rgba(0,0,0,0.12)',
        'btn': '0 2px 8px rgba(27,73,101,0.20)',
        'btn-hover': '0 4px 20px rgba(27,73,101,0.18)',
        'btn-accent': '0 2px 8px rgba(244,162,97,0.25)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      keyframes: {
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'card-appear': {
          from: { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          to:   { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'modal-enter': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'drawer-enter': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'drawer-exit': {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-100%)' },
        },
        'toast-enter': {
          from: { opacity: '0', transform: 'translateY(-12px) scale(0.95)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'bar-grow': {
          from: { transform: 'scaleY(0)' },
          to:   { transform: 'scaleY(1)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'page-enter': 'page-enter 250ms ease-out both',
        'card-appear': 'card-appear 300ms ease-out both',
        'modal-enter': 'modal-enter 200ms cubic-bezier(0.34, 1.26, 0.64, 1) both',
        'drawer-enter': 'drawer-enter 280ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'drawer-exit': 'drawer-exit 240ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'toast-enter': 'toast-enter 300ms cubic-bezier(0.34, 1.26, 0.64, 1) both',
        'fade-in': 'fade-in 200ms ease-out both',
        'slide-up': 'slide-up 300ms ease-out both',
      },
    },
  },
  plugins: [],
}

export default config;
