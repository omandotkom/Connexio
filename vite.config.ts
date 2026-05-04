import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	root: "src/renderer",
	base: "./",
	build: {
		outDir: "../../dist/renderer",
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src/renderer"),
			"@shared": path.resolve(__dirname, "src/shared"),
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
