/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Supports switching to dark mode via class
  theme: {
    extend: {
      colors: {
        // Custom neutral colors fitting the minimalist, analog palette
        cream: {
          50: '#FAF8F5',
          100: '#F5F2EB', // Core beige background
          200: '#E6E1D3',
          900: '#202122', // Deep charcoal/muted brown text
        },
        charcoal: {
          800: '#1F1F1F',
          900: '#121212',
        }
      },
      fontFamily: {
        serif: ['Montserrat', 'system-ui', 'sans-serif'],
        archi: ['Cinzel', 'serif']
      }
    },
  },
  plugins: [],
}
