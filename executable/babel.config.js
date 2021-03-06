module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
        modules: process.argv.includes('--esm') ? false : 'commonjs',
      },
    ],
    '@babel/preset-typescript',
  ],
  sourceMaps: true,
  include: ['./src/**/*.ts'],
  ignore: process.env.NODE_ENV === 'test' ? undefined : ['./src/**/*.test.ts'],
};
