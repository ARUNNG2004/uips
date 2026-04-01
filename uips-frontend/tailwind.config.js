/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'uips-bg': '#0a0e1a',
        'uips-surface': '#0f1629',
        'uips-card': '#151d35',
        'uips-border': '#1e2d4a',
        'uips-primary': '#3b82f6',
        'uips-danger': '#ef4444',
        'uips-warning': '#f59e0b',
        'uips-success': '#10b981',
        'uips-text': '#f1f5f9',
        'uips-muted': '#64748b'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.15)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.15)'
      }
    },
  },
  plugins: [],
}
