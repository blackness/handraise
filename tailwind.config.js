/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EBF3FB',
          100: '#D6E4F0',
          200: '#A8C8E8',
          300: '#7AAED4',
          400: '#4A7FB5',
          500: '#1E3A5F',  // primary
          600: '#183050',
          700: '#122540',
          800: '#0C1A30',
          900: '#060F1F',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['DM Sans', 'sans-serif'],
      }
    }
  },
  plugins: []
}
