const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    'background.bundle': './background.js',
    'content.bundle': './content.js',
    popup: './popup.js',
    'popup-pro': './popup-pro.js',
    'prompt-editor': './prompt-editor.js',
    settings: './settings.js',
    humanizer: './humanizer.js',
    compromise: './compromise.js',
    'compromise-sentences.min': './compromise-sentences.min.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        // HTML files
        { from: 'popup.html', to: '.', noErrorOnMissing: true },
        { from: 'prompt-editor.html', to: '.', noErrorOnMissing: true },
        { from: 'settings.html', to: '.', noErrorOnMissing: true },
        // CSS
        { from: 'editor.css', to: '.', noErrorOnMissing: true },
        // Manifest
        {
          from: 'manifest.json',
          to: '.',
          force: true,
          transform(content) {
            // Update manifest to use .bundle.js for background and content scripts
            const manifest = JSON.parse(content.toString());
            if (manifest.background && manifest.background.service_worker) {
              manifest.background.service_worker = 'background.bundle.js';
            }
            if (manifest.content_scripts) {
              manifest.content_scripts.forEach(cs => {
                if (Array.isArray(cs.js)) {
                  cs.js = cs.js.map(js => js === 'content.js' ? 'content.bundle.js' : js);
                }
              });
            }
            return JSON.stringify(manifest, null, 2);
          }
        },
        // Icons - use noErrorOnMissing to prevent build failures
        { from: 'extensionLogo.png', to: '.', noErrorOnMissing: true },
        { from: 'icons/extensionLogo.png', to: '.', noErrorOnMissing: true },
        { from: 'icons/red.png', to: '.', noErrorOnMissing: true },
        { from: 'icons/orange.png', to: '.', noErrorOnMissing: true },
        { from: 'icons/darkblue.png', to: '.', noErrorOnMissing: true },
        { from: 'icons/green.png', to: '.', noErrorOnMissing: true },
        { from: 'icons/purple.png', to: '.', noErrorOnMissing: true },
        { from: 'icons/teal.png', to: '.', noErrorOnMissing: true },
        { from: 'icons/yellow.png', to: '.', noErrorOnMissing: true },
        // Package files if they exist
        { from: 'package.json', to: '.', noErrorOnMissing: true },
        { from: 'package-lock.json', to: '.', noErrorOnMissing: true },
        // Any other files that might exist
        { from: 'norse.bold.otf', to: '.', noErrorOnMissing: true }
      ],
    }),
  ],
  module: {
    rules: [
      // You can uncomment these if you want to add Babel/CSS processing
      // {
      //   test: /\.js$/,
      //   exclude: /node_modules/,
      //   use: {
      //     loader: 'babel-loader',
      //     options: {
      //       presets: ['@babel/preset-env']
      //     }
      //   }
      // },
      // {
      //   test: /\.css$/,
      //   use: ['style-loader', 'css-loader']
      // }
    ],
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
  devtool: false,
};
