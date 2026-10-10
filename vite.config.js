import {defineConfig} from 'vite';

export default defineConfig({
  build:{
    rollupOptions:{
      output:{
        manualChunks(id){
          const normalized=id.replaceAll('\\','/');
          if(normalized.includes('/node_modules/three/examples/'))return 'three-addons';
          if(normalized.includes('/node_modules/three/'))return 'three-core';
        }
      }
    }
  }
});
