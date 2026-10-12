import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // Vue gọi /api/... -> Vite chuyển sang Express, khỏi cấu hình CORS
    proxy: { '/api': 'http://localhost:3000' },
  },
});
