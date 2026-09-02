import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {
      nitroMock: false,
      printInfoMap: {},
    },
    vite: {
      server: {
        port: 5667,
        proxy: {
          '/api': {
            changeOrigin: true,
            target: 'http://127.0.0.1:3100',
            ws: true,
          },
        },
      },
    },
  };
});
