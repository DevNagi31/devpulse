import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Apple's SF Pro stack — falls back gracefully on non-Apple platforms
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Inter',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Apple-ish palette: cool grays, electric blue accent
        ink: {
          50:  '#f5f5f7', // apple's signature off-white
          100: '#e5e5e7',
          200: '#c7c7cc',
          400: '#86868b',
          600: '#424245',
          800: '#1d1d1f', // apple's primary text
          900: '#000000',
        },
        accent: {
          DEFAULT: '#0071e3', // apple's CTA blue
          hover: '#0077ED',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 30px rgba(0,0,0,0.06)',
        'glass-dark': '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 30px rgba(0,0,0,0.5)',
      },
      letterSpacing: {
        tightest: '-0.022em',
      },
    },
  },
  plugins: [],
} satisfies Config;
