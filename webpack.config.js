const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: {
        bundle: './src/biomorphs.js'
    } ,
    devtool: 'inline-source-map',
    devServer: {
      contentBase: './dist',
    },
    output: {
    	filename: 'bundle.js',
        path: path.resolve(__dirname, './dist')
    },
    module: {
        rules: [
            { test: /\.hbs$/, loader: "handlebars-loader" },
            {
              test: /\.css$/i,
              use: ['style-loader', 'css-loader'],
            },
            {
              test: /\.js/,
              exclude: /(node_modules)/,
              loader: 'babel-loader',
            },
        ] 
    },
    plugins: [
        new webpack.LoaderOptionsPlugin({
            options: {
              handlebarsLoader: {}
            }
          }),
        new HtmlWebpackPlugin({
        	templateParameters: {title: 'defy.org: Biomorphs'},
            template: './src/index.hbs'
          }),
        // For Hugo
        new HtmlWebpackPlugin({
            template: './src/body.hbs',
            filename: 'hugo-partial.html'
          })
      ]
};
