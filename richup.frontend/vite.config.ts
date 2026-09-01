import { defineConfig, type PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [vue()];

  // Selector is a local development aid. Production and cloud builds must not
  // depend on the workstation-only file package under ../../plugins.
  if (command === 'serve') {
    try {
      const selectorPackage = '@terry/selector-dev';
      const selectorModule = await import(/* @vite-ignore */ selectorPackage) as {
        default: () => PluginOption;
      };
      plugins.push(selectorModule.default());
    } catch {
      console.warn('Selector Dev is not installed; continuing without it.');
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
    },
  };
});
