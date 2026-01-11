import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Use "/" when deploying to the root of a subdomain
  base: "/", 
});
