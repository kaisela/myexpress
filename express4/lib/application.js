'use strict'
/**
 * 采用的是设计模式中的模块模式，定义app对象，为其挂载方法
 */
const http = require('http')
let app = exports = module.exports = {}
let methods = http.METHODS // 获取http的所有请求方式
const slice = Array.prototype.slice;
const setPrototypeOf = require('setprototypeof')
const Router = require('./router')
const finalhandler = require('finalhandler') // http request 最后的函数处理,主要包括错误处理 https://www.npmjs.com/package/finalhandler
const flatten = require('array-flatten').flatten
const trustProxyDefaultSymbol = '@@symbol:trust_proxy_default'

const compileQueryParser = require('./utils').compileQueryParser
// 3:新增 req.query 中间件的处理
const query = require('./middleware/query')
// 4:新增 初始中间件，对req，res，app等进行相互关联
const middleware = require('./middleware/init')

/**
 * 初始化app对象需要的一些基础设置
 * paths: 存放所有使用get方法注册的请求，单体对象的格式为:
 * {
*     pathURL  请求的地址
      cb  请求对应的回调函数
 * }
 */
app.init = function init() {
  this.settings = {}
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
  // 3:新增 设置query中间件的默认调用函数
  this.set('query parser', 'extended')

  this.on('mount', function onmount(parent) {
    setPrototypeOf(this.request, parent.request)
    setPrototypeOf(this.response, parent.response)
    setPrototypeOf(this.settings, parent.settings)
  })
}
/**
 * 对app中setting对象的操作，为后期迭代预留
 */
app.set = function set(key, val) {
  if (arguments.length === 1) {
    return this.settings[key]
  }
  this.settings[key] = val
  // 3:新增 设置query中间件中query处理的默认调用函数
  switch (key) {
    case 'query parser':
      this.set('query parser fn', compileQueryParser(val));
      break
  }
  return this
}
/**
 * http.createServer 中的回调函数最终执行
 * 调用的是_router.handle 对url进行精确定位和匹配
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
 * 对路由实现装载，实例化
 */
app.lazyrouter = function () {
  if (!this._router) {
    this._router = new Router()
    // 3:新增 注册处理query的中间件
    this
      ._router
      .use(query(this.get('query parser fn')))
    // 4:新增 初始中间件，对req，res，app等进行相互关联
    this
      ._router
      .use(middleware.init(this))
  }
}

/**
 * 实现post，get等http.METHODS 对应的方法
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
      .route(path) // 调用_router的route方法，对path和route注册
    route[method].apply(route, slice.call(arguments, 1)) // 调用route的method方法，对method和callbacks注册
  }
})

/**
 * 3:新增 实现app的param接口
 * @param {*} name 参数名称 可以是数组 或者 字符串
 * @param {*} fn 需要处理的中间件
 */
app.param = function param(name, fn) {
  this.lazyrouter()
  // 如果name是数组时，分割调用自身
  if (Array.isArray(name)) {
    for (let i = 0; i < name.length; i++) {
      this.param(name[i], fn)
    }
    return this
  }
  this
    ._router
    .param(name, fn)
  return this
}
/**
 * 3:新增 暴露给用户注册中间件的结构，主要调用router的use方法
 * @param {*} fn
 */
app.use = function use(fn) {
  let offset = 0
  let path = '/'

  if (typeof fn !== 'function') {
    let arg = fn
    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0]
    }

    if (typeof arg !== 'function') {
      offset = 1
      path = fn
    }
  }
  // 4:新增 对传入的参数进行处理，是参数可以传入数组
  let fns = flatten(slice.call(arguments, offset))
  if (fns.length === 0) {
    throw new TypeError('app.use() require a middlewaare function')
  }

  this.lazyrouter()
  let router = this._router
  fns.forEach(function (fn) {
    // 4:修改 通常use里面是一个express对象，或者router对象时会包含handle和set，不包含为普通中间件
    if (!fn || !fn.handle || !fn.set) {
      return router.use(path, fn)
    }
    // 4:新增 此时的fn为express或router对象，将当前express对象关联到fn
    fn.parent = this

    router.use(path, function mounted_app(req, res, next) {
      let orig = req.app
      // 4:新增 在中间件的回调函数中调用fn的handle
      fn.handle(req, res, function (err) {
        setPrototypeOf(req, orig.request)
        setPrototypeOf(res, orig.response)
        next(err)
      })
    })
    // 4:新增 触发fn挂载完成事件
    fn.emit('mount', this)
  }, this)
}