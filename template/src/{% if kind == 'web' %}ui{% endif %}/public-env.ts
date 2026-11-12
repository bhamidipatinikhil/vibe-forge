import { createEnv } from "@t3-oss/env-core";
import { clientSchema } from "./env.schema";

/** Validated browser configuration (see {@link clientSchema}). The only module that reads `import.meta.env`. */
export const clientEnv = createEnv({
	clientPrefix: "VITE_",
	client: clientSchema,
	runtimeEnv: import.meta.env,
	emptyStringAsUndefined: true,
});
