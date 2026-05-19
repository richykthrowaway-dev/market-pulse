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
      // OpenSky proxy kept for local dev only — production uses direct browser fetch
      // (OpenSky blocks cloud/datacenter IPs so server-side proxies fail)
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: () => '/api/states/all',
      },
    },
  },
  // Pre-bundle the heavy libraries that are ONLY reached through lazy-loaded
  // routes (Trading → recharts/d3; dialogs → radix). Without this, Vite can't
  // see them at cold start, so the first navigation to such a route triggers
  // an on-the-fly dependency re-optimization + a forced full-page reload —
  // which, with libs this heavy, can stall or loop until `npm run dev` is
  // restarted ("clicking Trading crashes the site / won't load until restart").
  // Listing them here makes Vite bundle them once upfront. Dev-only; the
  // production Rollup build is unaffected.
  optimizeDeps: {
    include: [
      'recharts',
      'victory-vendor/d3-shape',
      'victory-vendor/d3-scale',
      'd3-shape',
      'd3-scale',
      '@tanstack/react-query',
      '@radix-ui/react-select',
      'lucide-react',
    ],
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
