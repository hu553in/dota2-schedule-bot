import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import vitest from "ultracite/oxlint/vitest";

const [vitestOverride] = vitest.overrides ?? [];

// Extended configs currently take precedence over local rule settings. Merge the
// presets directly until https://github.com/oxc-project/oxc/issues/20067 is fixed.
export default defineConfig({
  ...core,
  overrides: [
    ...(core.overrides ?? []),
    {
      files: vitestOverride?.files ?? [],
      plugins: vitestOverride?.plugins ?? [],
      rules: {
        ...vitestOverride?.rules,
        "vitest/max-expects": "off",
        "vitest/require-mock-type-parameters": "off",
        "vitest/valid-expect": "off",
      },
    },
  ],
  rules: {
    ...core.rules,
    "class-methods-use-this": "off",
    "func-style": "off",
    "max-classes-per-file": "off",
    "no-use-before-define": ["error", { functions: false }],
    "node/callback-return": "off",
    "prefer-named-capture-group": "off",
    "promise/avoid-new": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",
  },
});
