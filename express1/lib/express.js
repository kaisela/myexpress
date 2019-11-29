const mixin = require('merge-descriptors')
let proto = require('./application')

exports = module.exports = createApplication

function createApplication() {
  let app = function (req, res, next) {
    console.log('handle')
    app.handle(req, res, next)
  }
  mixin(app, proto, false)

  app.init()
  return app
}