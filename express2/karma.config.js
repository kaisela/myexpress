// Karma configuration Generated on Mon Nov 25 2019 15:04:23 GMT+0800 (CST)

module.exports = function (config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use available frameworks:
    // https://npmjs.org/browse/keyword/karma-adapter
    frameworks: [
      'mocha', 'chai'
    ],

    // list of files / patterns to load in the browser
    files: ['test/*.js'],

    // list of files / patterns to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser available
    // preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {},

    // test results reporter to use possible values: 'dots', 'progress' available
    // reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],

    // web server port
    port: 3000,

    // list of files / patterns to exclude
    exclude: ["karma.config.js"],
    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging possible values: config.LOG_DISABLE || config.LOG_ERROR ||
    // config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers available browser launchers:
    // https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],

    // karma 插件
    plugins: [
      "karma-mocha", "karma-chrome-launcher", "karma-chai"
    ],
    // Continuous Integration mode if true, Karma captures browsers, runs the tests
    // and exits
    singleRun: false,

    // Concurrency level how many browser should be started simultaneous
    concurrency: Infinity
  })
}
