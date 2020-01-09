const mixin = require('merge-descriptors')
let proto = require('./application')
const http = require('http')
const EventEmitter = require('events').EventEmitter
const Router = require('./router')

exports = module.exports = createApplication
/**
 * 创建app
 */
function createApplication() {
  let app = function (req, res, next) { // createServer的回调函数
    app.handle(req, res, next)
  }
  mixin(app, proto, false)
  // 4:新增 让app继承事件类
  mixin(app, EventEmitter.prototype, false)
  let req = Object.create(http.IncomingMessage.prototype)
  let res = Object.create(http.ServerResponse.prototype)
  // 4:新增 讲app和新创建的req相互关联
  app.request = Object.create(req, {
    app: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: app
    }
  })
  // 4:新增 讲app和新创建的res相互关联
  app.response = Object.create(res, {
    app: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: app
    }
  })
  app.init()
  return app
}

// 4:新增 将router暴露出来
exports.Router = Router