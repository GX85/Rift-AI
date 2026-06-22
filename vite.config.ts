import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — чтобы собранный dist открывался и из файла (Electron), и на Vercel.
export default defineConfig({
  base: './',
  plugins: [react()],
});
