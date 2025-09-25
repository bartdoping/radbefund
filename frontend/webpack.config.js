// webpack.config.js (Frontend)
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const fs = require("fs");
const os = require("os");

module.exports = {
  entry: {
    taskpane: require("path").resolve(__dirname, "src/taskpane/index.tsx"),
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    publicPath: "/",        // wichtig für DevServer
    clean: true,
  },
  mode: "development",
  devtool: "eval-cheap-module-source-map",
  resolve: { extensions: [".tsx", ".ts", ".js"] },
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader", exclude: /node_modules/ }
      // Kein html-loader nötig
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "taskpane.html",
      template: "./src/taskpane/taskpane.html",
      chunks: ["taskpane"],
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: "manifest.xml", to: "manifest.xml" }],
    }),
  ],
  
devServer: {
  port: 3002,
  // HTTP-Server für einfacheren Zugriff ohne Zertifikat-Probleme
  allowedHosts: "all",
  hot: true,
  historyApiFallback: { index: "/taskpane.html" },
  static: { directory: require("path").join(__dirname, "dist") },
},
};