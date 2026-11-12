// src/ui/client.tsx — TanStack Start's client entry: monitoring first, then hydration.
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { startMonitoring } from "./lib/monitoring";

startMonitoring();

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
	);
});
