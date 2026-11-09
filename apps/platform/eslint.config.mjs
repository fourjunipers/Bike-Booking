import { defineConfig } from "eslint/config";
import { nextApp } from "@mango/config/eslint/next";

// Next.js rules, Prettier, and "never import from another app".
export default defineConfig([...nextApp("platform")]);
