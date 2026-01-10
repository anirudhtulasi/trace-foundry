import next from "eslint-config-next";

const config = [
  {
    ignores: ["node_modules/**", "dist/**"]
  },
  ...next,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react/jsx-max-props-per-line": "off"
    }
  }
];

export default config;
