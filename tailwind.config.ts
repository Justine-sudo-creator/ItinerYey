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
        background: '#F5EBD8',
        surface: '#FFF8E8',
        primary: '#111111',
        secondary: '#4B4B4B',
        muted: '#6B6257',
        border: '#111111', // Override default border
        'border-dark': '#111111',
        accent: {
          coral: '#F15A4A',
          blue: '#5DADEC',
          yellow: '#F6C85F',
          green: '#4CAF7A',
        },
        'soft-beige': '#EFE2C6',
      },
      borderRadius: {
        DEFAULT: '4px',
        none: '0px',
        sm: '4px',
        md: '6px',
        lg: '6px',
        xl: '6px',
        '2xl': '6px',
        '3xl': '6px',
      },
      boxShadow: {
        hard: '4px 4px 0px #111111',
        'hard-sm': '3px 3px 0px #111111',
        none: '0 0 #0000',
      },
    },
  },
  plugins: [],
};
export default config;
