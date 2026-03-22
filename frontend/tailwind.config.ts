import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#040912',
          900: '#070D1B',
          800: '#0C1428',
          700: '#111C35',
          600: '#172243',
        },
      },
      fontFamily: {
        display: ['Syne', 'serif'],
        body: ['Plus Jakarta Sans', 'sans-serif'],
      },
      backgroundImage: {
        'speak-gradient': 'linear-gradient(135deg, #06B6D4 0%, #4F46E5 100%)',
        'speak-gradient-r': 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
      },
      animation: {
        'wave': 'wave 1.2s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        'fade-up': 'fadeUp 0.6s ease-out both',
        'fade-in': 'fadeIn 0.4s ease-out both',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-teal': '0 0 40px rgba(6, 182, 212, 0.3)',
        'glow-indigo': '0 0 40px rgba(79, 70, 229, 0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
export default config
