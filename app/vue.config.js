/* eslint-disable @typescript-eslint/no-var-requires */
const Config = require('webpack-chain');
const { genPathResolve } = require('@huiji/shared-utils');

const resolvePath = genPathResolve(__dirname);

module.exports = {
  parallel: false,
  outputDir: 'dist/renderer',
  filenameHashing: false,

  publicPath: './',
  runtimeCompiler: true,

  /**
   * @param {Config} config
   */
  chainWebpack: config => {
    config.target('electron-renderer');

    config.resolve.alias.delete('@').set('@src', resolvePath('src'));

    config
      .entry('app')
      .clear()
      .add('./src/renderer/renderer.ts');
  },

  devServer: {
    port: process.env.VUE_APP_PORT,
    open: false,
  },
};