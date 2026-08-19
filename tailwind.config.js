/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070b14',
          900: '#0b1120',
          850: '#0f1626',
          800: '#131c2e',
          700: '#1b2740',
          600: '#243352',
          500: '#33476b',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#b5d6ff',
          300: '#7ab4ff',
          400: '#3d8bff',
          500: '#1b6fff',
          600: '#0a54e6',
          700: '#0942b4',
          800: '#0c388f',
          900: '#0d3174',
        },
        mint: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a6f4d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        rose: {
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(59,139,255,0.15), 0 8px 24px -8px rgba(27,111,255,0.35)',
        card: '0 1px 0 rgba(255,255,255,0.04), 0 12px 32px -16px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 160ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'pop': 'pop 120ms ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pop: { from: { transform: 'scale(0.96)' }, to: { transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
