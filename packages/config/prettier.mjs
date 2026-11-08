// Shared Prettier settings. Prettier's defaults apply; apps with Tailwind
// call withTailwind() with their stylesheet so classes are sorted.

/** @type {import("prettier").Config} */
const base = {};

export function withTailwind(stylesheet) {
  return {
    ...base,
    plugins: ["prettier-plugin-tailwindcss"],
    tailwindStylesheet: stylesheet,
  };
}

export default base;
