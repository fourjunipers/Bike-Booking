import { defineConfig } from "eslint/config";
import { sharedPackage } from "@mango/config/eslint/package";

export default defineConfig([...sharedPackage({ pure: true })]);
