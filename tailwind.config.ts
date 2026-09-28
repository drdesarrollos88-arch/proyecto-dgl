import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#e20000', // Official IDIEM Red
          600: '#e20000', // Official IDIEM Red
          700: '#c20000', // IDIEM Darker Red / Hover
          800: '#990000',
          900: '#730000',
        },
        idiem: {
          red: '#E20000',
          darkRed: '#C20000',
          dark: '#1A1A1A',
          gray: '#474747',
          light: '#F8F9FA',
        },
      },
    },
  },
  plugins: [],
};
export default config;

