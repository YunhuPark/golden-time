/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Emergency Control Center Color Palette
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Emergency Status Colors (Neon Glow)
        critical: 'hsl(var(--critical))',
        warning: 'hsl(var(--warning))',
        safe: 'hsl(var(--safe))',
        info: 'hsl(var(--info))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-neon': {
          '0%, 100%': {
            opacity: '1',
            filter: 'drop-shadow(0 0 8px currentColor)',
          },
          '50%': {
            opacity: '0.8',
            filter: 'drop-shadow(0 0 16px currentColor)',
          },
        },
        'scan-line': {
          '0%': { top: '0' },
          '100%': { top: '100%' },
        },
        'ecg-pulse': {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
        'scan-line': 'scan-line 4s linear infinite',
        'ecg-pulse': 'ecg-pulse 1.5s ease-in-out infinite',
      },
      boxShadow: {
        'glow-critical': '0 0 20px rgba(255, 0, 61, 0.5), 0 0 40px rgba(255, 0, 61, 0.3)',
        'glow-safe': '0 0 20px rgba(0, 255, 102, 0.5), 0 0 40px rgba(0, 255, 102, 0.3)',
        'glow-info': '0 0 20px rgba(0, 217, 255, 0.5), 0 0 40px rgba(0, 217, 255, 0.3)',
        'glow-warning': '0 0 20px rgba(255, 214, 0, 0.5), 0 0 40px rgba(255, 214, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
