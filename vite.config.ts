import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;

              if (id.includes('@google/genai')) return 'ai-vendor';
              if (id.includes('xlsx')) return 'spreadsheet-vendor';
              if (id.includes('recharts')) return 'charts-vendor';
              if (id.includes('react-virtuoso')) return 'list-vendor';
              if (id.includes('@supabase/supabase-js')) return 'supabase-vendor';
              if (id.includes('framer-motion')) return 'motion-vendor';
              if (id.includes('lucide-react')) return 'icon-vendor';
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
