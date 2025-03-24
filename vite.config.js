import { fileURLToPath, URL } from 'node:url'
// import { resolve } from 'path'

import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import vue2 from '@vitejs/plugin-vue2'
import vue2Jsx from '@vitejs/plugin-vue2-jsx'
import viteCompression from 'vite-plugin-compression'
import mpa from 'vite-plugin-mpa'

import svgLoader from './svg-loader'
import svgSprite from './svg-sprite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'dist',
    // assetsDir: 'static',
    assetsDir: 'static/settings',
    // rollupOptions: {
    //   input: {
    //     main: resolve(__dirname, 'user/index.html'),
    //     admin: resolve(__dirname, 'admin/index.html')
    //   }
    // }
  },
  base: '/',
  // base: mode === 'development' ? '' : '/settings',
  plugins: [
    vue2(),
    vue2Jsx(),
    // solution for this vite limitation https://github.com/vitejs/vite/issues/1911
    mpa({
      open: '/user/'
    }),
    svgSprite({
      user: ['./icons/user'],
      admin: ['./icons/admin']
    }),
    svgLoader(),
    legacy({
      targets: ['ie >= 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }),
    viteCompression()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      path: 'path-browserify',
      https: 'agent-base'
    }
  },
  server: {
    proxy: {
      "/ws": {
        ws: true,
        //target: 'ws://localhost'
         target: 'ws://gisquick.nexusgeografics.com/'
        // target: 'wss://dev.gisquick.org'
      },
      "/api": {
         target: 'https://gisquick.nexusgeografics.com/'
        //target: 'http://localhost'
        // target: 'https://dev.gisquick.org',
        // target: 'https://portal.mapotip.cz:8443/',
        // changeOrigin: true,
        // secure: false,
        // cookieDomainRewrite: 'localhost'
      }
    }
  }
}))
