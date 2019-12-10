const mixin = require('merge-descriptors')
let proto = require('./application')

exports = module.exports = createApplication
/**
 * 创建app
 */
function createApplication() {
  let app = function (req, res, next) { // createServer的回调函数
    app.handle(req, res, next)
  }
  mixin(app, proto, false)
  app.init()
  return app
}