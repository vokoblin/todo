/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /** Custom css class extensions go here. */
    },
  },
  plugins: [],
}
