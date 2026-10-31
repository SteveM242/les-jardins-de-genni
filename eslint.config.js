import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    // Front : Vue + navigateur
    files: ["src/**/*.{js,vue}", "vite.config.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Le style est laissé à l'éditeur : on ne lint que les erreurs réelles et l'accessibilité de base.
      "vue/multi-word-component-names": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/html-indent": "off",
      "vue/first-attribute-linebreak": "off",
      "vue/require-default-prop": "off",
      "vue/attributes-order": "off",
      "vue/no-v-html": "error"
    }
  },
  {
    // Serveur : Node, CommonJS
    files: ["*.cjs", "lib/**/*.cjs", "routes/**/*.cjs", "scripts/**/*.cjs", "test/**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } }
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }]
    }
  }
];
