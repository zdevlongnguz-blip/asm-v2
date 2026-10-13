import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const configuredBasePath = env.VITE_BASE_PATH?.trim() || '/';
  const basePath = configuredBasePath.startsWith('/') ? configuredBasePath : `/${configuredBasePath}`;
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const defaultApiBaseUrl = `${normalizedBasePath}api`.replace(/\/+/g, '/');
  const configuredApiBaseUrl = env.VITE_API_BASE_URL?.trim();
  const apiBaseUrl = (configuredApiBaseUrl || defaultApiBaseUrl).replace(/\/+$/, '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

  return {
    base: normalizedBasePath,
    plugins: [vue()],
    server: {
      proxy: apiBaseUrl.startsWith('/')
        ? {
            [apiBaseUrl]: {
              target: proxyTarget,
              changeOrigin: true,
              ...(configuredApiBaseUrl || normalizedBasePath === '/'
                ? {}
                : { rewrite: (path) => path.replace(apiBaseUrl, '/api') }),
            },
          }
        : {},
    },
  };
});
