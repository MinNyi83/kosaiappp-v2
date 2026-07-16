/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.html', './public/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#f59e0b',
          dark: '#09090b',
          panel: '#121218',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
