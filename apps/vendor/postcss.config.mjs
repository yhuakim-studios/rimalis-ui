// Tailwind v4 is a PostCSS plugin in its own package — `tailwindcss` itself is
// no longer the plugin, which is the most common v3→v4 migration error.
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};

export default config;
