module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  extends: [
    "eslint:recommended"
  ],
  rules: {
    "no-unused-vars": "warn",
    "no-console": "off",
    "quotes": ["warn", "single"],
    "indent": ["warn", 4],
    "semi": ["warn", "always"]
  },
  globals: {},
};
