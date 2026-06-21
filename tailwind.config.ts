import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-plus-jakarta-sans)', 'sans-serif'],
      },
      colors: {
        background: '#F8FAFC', // Slate 50 (Crisp off-white)
        surface: '#FFFFFF', // Pure clean White
        primary: '#0F172A', // Slate 900 (Deep charcoal for readability)
        secondary: '#475569', // Slate 600
        muted: '#64748B', // Slate 500
        border: '#E2E8F0', // Slate 200 (Subtle borders)
        'border-dark': '#E2E8F0', // Slate 200
        accent: {
          coral: '#EF4444', // Slate Red
          blue: '#3B82F6', // Slate Blue
          yellow: '#F59E0B', // Slate Amber
          green: '#10B981', // Emerald Green
        },
        'soft-beige': '#F1F5F9', // Slate 100 (Sleek divider fill)
      },
      borderRadius: {
        DEFAULT: '8px',
        none: '0px',
        sm: '6px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        // Redefined offsets into beautiful modern ambient shadows
        hard: '0 10px 15px -3px rgba(15, 23, 42, 0.04), 0 4px 6px -4px rgba(15, 23, 42, 0.02)',
        'hard-sm': '0 4px 6px -1px rgba(15, 23, 42, 0.03)',
        none: '0 0 #0000',
      },
    },
  },
  plugins: [],
};
export default config;
