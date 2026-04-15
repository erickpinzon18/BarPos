// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        gray: {
          850: '#1a1a2e',
        },
        neon: {
          red: '#ff1744',
          'red-dark': '#d50000',
          'red-light': '#ff5252',
          'red-glow': '#ff1744',
        },
      },
      boxShadow: {
        'neon-red': '0 0 15px rgba(255, 23, 68, 0.5), 0 0 30px rgba(255, 23, 68, 0.2)',
        'neon-red-lg': '0 0 25px rgba(255, 23, 68, 0.6), 0 0 50px rgba(255, 23, 68, 0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config