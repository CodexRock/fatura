import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1B4965',
        secondary: '#5FA8D3',
        accent: '#F4A261',
        success: '#2D6A4F',
        danger: '#E63946',
        background: '#F8F9FA',
        surface: '#FFFFFF',
        'text-primary': '#1A1A2E',
        'text-secondary': '#6B7280',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        arabic: ['"Noto Kufi Arabic"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config;
