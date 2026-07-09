import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path is set to the repository name so the production build works
// correctly when served from GitHub Pages at /<repo>/. Locally it falls
// back to root so `npm run dev` and `npm run preview` behave normally.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/driftlineArcade/' : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
