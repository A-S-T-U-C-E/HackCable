const path = require('path');
const webpack = require('webpack')

module.exports = {
    entry: ["@babel/polyfill", path.resolve(__dirname, 'src') + "/main.ts"],
    performance: {
        hints: false
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist/src'),
        library: "hackcable",
        libraryTarget: "umd", // exposes and know when to use module.exports or exports.
        clean: true,
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
        alias: {
            // Pin le build dist (évite un graphe webpack obsolète sur le src lié en file:)
            librecircuit: path.resolve(__dirname, 'node_modules/librecircuit/dist/index.js'),
            'draw2d-types': false,
        },
    },
    module: {
        rules: [
            { // TS loader (transpile local file: librecircuit as well)
                test: /\.(js|ts)$/,
                exclude: /node_modules[\\/](?!librecircuit)/,
                use: {
                    loader: 'babel-loader'
                },
            },
            {
                test: /\.html$/i,
                loader: "html-loader",
            },
            {
                test: /\.styl$/,
                use: [
                    "style-loader",
                    "css-loader",
                    {
                        loader: "stylus-loader",
                        options: {
                            webpackImporter: false,
                        },
                    },
                ],
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"]
            }
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        })
    ]

};