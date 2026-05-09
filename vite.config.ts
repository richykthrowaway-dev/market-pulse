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
      // ── OpenSky proxy: avoids CORS issues with direct browser requests ──
      // In production the same path is served by api/opensky.ts (Vercel function).
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: () => '/api/states/all',
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Three.js / globe — already lazy-loaded, keep isolated
          if (id.includes('three') || id.includes('react-globe') || id.includes('globe.gl')) {
            return 'vendor-three';
          }
          // D3 + topojson — lazy-loaded by MapView, keep isolated
          if (id.includes('node_modules/d3') || id.includes('node_modules/topojson') || id.includes('node_modules/d3-')) {
            return 'vendor-d3';
          }
          // Recharts + dependencies
          if (id.includes('recharts') || id.includes('victory-vendor')) {
            return 'vendor-charts';
          }
          // Radix UI primitives
          if (id.includes('@radix-ui')) {
            return 'vendor-radix';
          }
          // Tanstack (React Query + Table)
          if (id.includes('@tanstack')) {
            return 'vendor-tanstack';
          }
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // Supabase client
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
          // Lucide icons
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
}));
