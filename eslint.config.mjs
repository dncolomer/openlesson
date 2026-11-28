import { defineConfig, globalIgnores } from "eslint/config";
import nextConfig from "eslint-config-next";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextConfig,
  ...nextTs,
  {
    rules: {
      // Pre-existing patterns across the codebase; keep lint usable after Next 16 removed `next lint`.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/prefer-as-const": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
        },
      ],
      "@next/next/no-img-element": "warn",
      "react/no-unescaped-entities": "warn",
      "import/no-anonymous-default-export": "off",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["lib/stripe/client.ts"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "stripe",
              importNames: ["default"],
              allowTypeImports: true,
              message:
                "Use getStripe() from '@/lib/stripe/client' instead of instantiating Stripe directly (type-only imports are allowed).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
