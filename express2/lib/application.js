'use strict'
/**
 * 采用的是设计模式中的模块模式，定义app对象，为其挂载方法
 */
const http = require('http')
let app = exports = module.exports = {}
let methods = http.METHODS // 获取http的所有请求方式
const slice = Array.prototype.slice;
const Router = require('./router')
const finalhandler = require('finalhandler') // http request 最后的函数处理,主要包括错误处理 https://www.npmjs.com/package/finalhandler
/**
 * 初始化app对象需要的一些基础设置
 * paths: 存放所有使用get方法注册的请求，单体对象的格式为:
 * {
*     pathURL  请求的地址
      cb  请求对应的回调函数
 * }
 */
app.init = function init() {
  this.setting = {}
  this.paths = []
  this.defaultConfiguration()
}
/**
 * 设置环境变量env，后期迭代预留
 */
app.defaultConfiguration = function defaultConfiguration() {
  let env = process.env.NODE_ENV || 'development'
  this.set('env', env)
  this.set('jsonp callback name', 'callback')
}
/**
 * 对app中setting对象的操作，为后期迭代预留
 */
app.set = function set(key, val) {
  if (arguments.length === 1) {
    return this.setting[key]
  }
  this.setting[key] = val
}
/**
 * http.createServer 中的回调函数最终执行，遍历paths，确定调用哪个get函数中的回调函数
 */
app.handle = function handle(req, res) {
  let router = this._router
  let done = finalhandler(req, res, {
    env: this.get('env'),
    onerror: logerror.bind(this)
  })
  if (!router) {
    done()
  }
  router.handle(req, res, done)
}

function logerror(err) {
  /* istanbul ignore next */
  if (this.get('env') !== 'test') 
    console.error(err.stack || err.toString());
  }

/**
 * 启动http服务
 */
app.listen = function listen() {
  let server = http.createServer(this)
  return server
    .listen
    .apply(server, arguments)
}
/**
 * 实现app的get接口，主要是对所有的get请求进行注册，方便handle中实现精准回调
 */
/* app.get = function get(path, cb) {
  let pathObj = {
    pathURL: path,
    cb: cb
  }
  this
    .paths
    .push(pathObj)
} */

/**
 * 对路由实现装载
 */
app.lazyrouter = function () {
  if (!this._router) {
    this._router = new Router()
  }
}

/**
 * 实现post，get等http。methods 对应的方法
 */

methods.forEach((method) => {
  method = method.toLowerCase()
  app[method] = function (path) {
    if (method === 'get' && arguments.length === 1) { // 当为一个参数时app的get方法，返回settings中的属性值
      return this.set(path)
    }
    this.lazyrouter()
    let route = this
      ._router
      .route(path)
    route[method].apply(route, slice.call(arguments, 1))
  }
})