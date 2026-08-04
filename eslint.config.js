import antfu from "@antfu/eslint-config";

export default antfu({
  react: true,
  typescript: true,
  formatters: false,
  stylistic: {
    quotes: "double",
    semi: true,
  },
  ignores: [
    "dist/**",
    "server/dist/**",
    "server/node_modules/**",
    "public/**",
  ],
}, {
  rules: {
    "style/jsx-one-expression-per-line": "off",
    "style/multiline-ternary": "off",
    "react/no-forward-ref": "off",
    "react/no-array-index-key": "off",
    "react/purity": "off",
    "no-console": ["warn", { allow: ["warn", "error", "log"] }],
  },
});
