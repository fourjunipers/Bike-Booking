// Lets `node scripts/seed.mts` import the app's own TypeScript modules, which
// (like all Next.js code) import each other without a file extension.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith("."))
        return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
