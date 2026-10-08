import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Constitution IX: TypeScript strict, no `any`.
      "@typescript-eslint/no-explicit-any": "error",
      // Constitution VIII: all images go through next/image.
      "@next/next/no-img-element": "error",
    },
  },
  // Feature 006 (ADR 0008): the staff app is isolated. Only src/admin/**, the (admin) route group, its BFF route, the proxy
  // and tests may import it, so no public-site bundle can pull in admin code.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/admin", "@/admin/**"],
              message: "Only src/admin/**, src/app/(admin)/**, src/app/api/admin/** and src/proxy.ts may import @/admin/* (ADR 0008).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/admin/**", "src/app/(admin)/**", "src/app/api/admin/**", "src/proxy.ts", "tests/**"],
    rules: { "no-restricted-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output
    "src/lib/api/schema.gen.ts",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
