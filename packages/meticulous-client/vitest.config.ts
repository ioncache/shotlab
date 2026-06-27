import { mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  resolve: {
    alias: {
      '~': resolve(import.meta.dirname, 'src'),
    },
  },
});
