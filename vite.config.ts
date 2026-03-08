import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  assetsInclude: ['**/*.geojson'],
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/finnhub': {
        target: 'https://fzokumkbgvwsyftwwprx.functions.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/finnhub/, '/api-finnhub'),
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2t1bWtiZ3Z3c3lmdHd3cHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTM2MDAsImV4cCI6MjA4ODMyOTYwMH0.7gg92KfZxouICjHJAwSeImmnqVxQhK7Evt8xit5vMYE',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2t1bWtiZ3Z3c3lmdHd3cHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTM2MDAsImV4cCI6MjA4ODMyOTYwMH0.7gg92KfZxouICjHJAwSeImmnqVxQhK7Evt8xit5vMYE',
        },
      },
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
