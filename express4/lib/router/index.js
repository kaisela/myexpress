'use strict'

const debug = require('debug')('router')
const Route = require('./route')
const Layer = require('./layer')
let methods = require('http').METHODS
const parseUrl = require('parseurl')
const mixin = require('merge-descriptors')
const flatten = require('array-flatten').flatten
// 3:新增，用于获取对象类型
const objectRegExp = /^\[object (\S+)\]$/
const slice = Array.prototype.slice
const toString = Object.prototype.toString

/**
 *
 */

let proto = module.exports = function (options) {
  let ops = options || {}
  function router(req, res, next) {
    router.handle(req, res, next)
  }

  mixin(router, proto)
  router.params = {}
  router._params = []
  router.stack = []
  return router
}

/**
 * 将path和route对应起来，并放进stack中，对象实例为layer
 */
proto.route = function route(path) {
  let route = new Route(path)
  let layer = new Layer(path, {
    end: true
  }, route.dispatch.bind(route))
  layer.route = route
  this
    .stack
    .push(layer)
  return route
}

/**
 * 遍历stack数组，并处理函数, 将res req 传给route
 */

proto.handle = function handle(req, res, out) {
  let self = this
  debug('dispatching %s %s', req.method, req.url)
  let idx = 0
  let stack = self.stack
  // 3:修改 对req调用handle时的初始值进行保存，返回处理函数，以便随时恢复初始值
  let done = restore(out, req, 'baseUrl', 'next', 'params')
  let paramcalled = {}
  // 4:新增 用于存放url中和中间件中的path相匹配的部分
  let removed = ''
  // 4:新增 在移除中间件部分之后，是否给url加过 /
  let slashAdded = false
  // 4:新增 如果是子路由，或者子app 会存在父app的params
  let parentPrarms = req.params
  // 4:新增 如果是子路由，或者子app url 存于baseUrl中
  let parentUrl = req.baseUrl || ''
  req.next = next

  req.baseUrl = parentUrl
  req.originalUrl = req.originalUrl || req.url
  next() //第一次调用next
  function next(err) {
    let layerError = err === 'route'
      ? null
      : err
    // 4:新增 如果添加过 / 则移除
    if (slashAdded) {
      req.url = req
        .url
        .substr(1)
      slashAdded = false
    }
    // 4:新增 如果移除过中间件匹配到的部分，则还原
    if (removed.length !== 0) {
      req.baseUrl = parentUrl
      req.url = removed + req.url
      removed = ''
    }

    if (layerError === 'router') { //如果错误存在，再当前任务结束前调用最终处理函数
      setImmediate(done, null)
      return
    }

    if (idx >= stack.length) { // 遍历完成之后调用最终处理函数
      setImmediate(done, layerError)
      return
    }

    // 3: 新增path ，用于获取除query之外的path
    let path = getPathname(req)
    if (!path) {
      return done(layerError)
    }
    let layer
    let match
    let route
    while (match !== true && idx < stack.length) { //从数组中找到匹配的路由
      layer = stack[idx++]
      match = matchLayer(layer, path)
      route = layer.route
      if (typeof match !== 'boolean') {
        layerError = layerError || match
      }

      if (match !== true) {
        continue
      }
      // 3:新增，原逻辑中不可能存在route没有的情况，在3中加入query中间件，其route为undefined
      if (!route) {
        continue
      }
      if (layerError) {
        match = false
        continue
      }
      let method = req.method
      let has_method = route._handles_method(method)
      if (!has_method) {
        match = false
        continue
      }
    }
    if (match !== true) { // 循环完成没有匹配的路由，调用最终处理函数
      return done(layerError)
    }
    req.params = mixin(parentPrarms || {}, layer.params) // 将解析的‘/get/:id’ 中的id剥离出来
    // 4:新增
    let layerPath = layer.path

    // 3:新增，主要是处理app.param
    self.process_params(layer, paramcalled, req, res, function (err) {
      if (err) {
        return next(layerError || err)
      }
      if (route) {
        //调用route的dispatch方法，dispatch完成之后在此调用next，进行下一次循环
        return layer.handle_request(req, res, next)
      }
      // 3:新增，加入handle_error处理
      trim_prefix(layer, layerError, layerPath, path)
    })
  }

  function trim_prefix(layer, layerError, layerPath, path) {
    if (layerPath.length !== 0) {
      let c = path[layerPath.length]
      if (c && c !== '/' && c !== '.') 
        return next(layerError)
        // 4:新增 移除中间件中带的path，在父子app中，剥离出子app需要匹配的url 通过req带入子app的handle中
      removed = layerPath
      req.url = req
        .url
        .substr(removed.length)
      if (req.url[0] !== '/') {
        req.url = '/' + req.url
        slashAdded = true
      }
      req.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
        ? removed.substr(0, removed.length - 1)
        : removed)
    }
    if (layerError) {
      layer.handle_error(layerError, req, res, next)
    } else {
      layer.handle_request(req, res, next)
    }
  }

}

/**
 * 3:新增 获取除query部分的路径 例如： /get?id=12 --> /get
 */

function getPathname(req) {
  try {
    return parseUrl(req).pathname
  } catch (e) {
    return undefined
  }
}

/**
 * 判断url是否符合layer.path的规则
 */
function matchLayer(layer, path) {
  try {
    return layer.match(path);
  } catch (err) {
    return err;
  }
}
/**
 * 3:新增 对传过来的参数进行拦截，将参数拦截相关存入到params中，在handle中进行分解执行
 */
proto.param = function param(name, fn) {
  if (typeof name === 'function') {
    this
      ._params
      .push(name)
    return
  }
  if (name[0] === ':') {
    name = name.substr(1)
  }
  let params = this._params
  let len = this._params.length
  let ret
  for (let i = 0; i < len; i++) {
    if (ret = params[i](name, fn)) {
      fn = ret
    }
  }
  (this.params[name] = this.params[name] || []).push(fn)
}
/**
 * 3:新增 遍历params，匹配到合适的param，执行拦截
 * @param {*} layer 当前layer
 * @param {*} called 已经执行过的param
 * @param {*} req
 * @param {*} res
 * @param {*} done
 */
proto.process_params = function process_params(layer, called, req, res, done) {
  let params = this.params
  let keys = layer.keys
  let keysIndex = 0
  let key
  let name
  let paramcbIndex = 0
  let paramcallbacks
  let paramVal
  let paramCalled
  if (keys.length === 0) {
    return done()
  }
  /**
   * 3:新增 遍历当前url所对应的param，存于layer.keys中
   * @param {} err
   */
  function param(err) {
    if (err) {
      return done(err)
    }
    // 临界值判断，跳出循环
    if (keysIndex >= keys.length) {
      return done()
    }
    key = keys[keysIndex++]
    name = key.name
    paramcbIndex = 0
    paramVal = req.params[name]
    paramcallbacks = params[name]
    paramCalled = called[name]
    if (paramVal === undefined || !paramcallbacks) {
      return param()
    }

    if (paramCalled && (paramCalled.match === paramVal || (paramCalled.error && paramCalled.error !== 'route'))) {
      req.params[name] = paramCalled.value
      return param()
    }

    called[name] = paramCalled = {
      error: null,
      match: paramVal,
      value: paramVal
    }
    paramCallback()
  }

  /**
   * 3:新增 遍历当前param-->key 对应的functions --> callbacks
   * @param {} err
   */
  function paramCallback(err) {
    let fn = paramcallbacks[paramcbIndex++]
    paramCalled.value = req.params[key.name]
    if (err) {
      paramCalled.error = err
      return param(err)
    }
    // 临界值，跳出循环
    if (!fn) {
      return param(err)
    }
    try {
      // 执行中间件
      fn(req, res, paramCallback, paramVal, name)
    } catch (e) {
      paramCallback(e)
    }
  }
  param()
}

/**
 * 3:新增 主要用于注册路由相关的中间件，此迭代中，在注册query中间件中使用到
 * @param {*} fn
 */
proto.use = function use(fn) {
  let path = '/'
  let offset = 0
  // 为app.use 接口准备，第一个参数可能时路径的正则表达式
  if (typeof fn !== 'function') {
    let arg = fn
    while (Array.isArray(arg) && arg.length != 0) {
      arg = arg[0]
    }
    if (typeof arg !== 'function') {
      offset = 1
      path = arg
    }
  }

  let callbacks = flatten(slice.call(arguments, offset))
  if (callbacks.length === 0) {
    throw new TypeError('Router.use() requires a middleware function')
  }

  // 将中间件加入到stack栈中，方便handle函数遍历中执行
  for (let i = 0; i < callbacks.length; i++) {
    let fn = callbacks[i]
    if (typeof fn !== 'function') {
      throw new TypeError('Router.use() requires a middleware function but not a ' + gettype(fn))
    }
    let layer = new Layer(path, {
      strict: false,
      end: false
    }, fn)
    layer.route = undefined
    this
      .stack
      .push(layer)
  }
}

/**
 * 3: 新增 获取对象的类型
 * @param {} obj
 */
function gettype(obj) {
  let type = typeof obj

  if (type !== 'object') {
    return type
  }

  return toString
    .call(obj)
    .replace(objectRegExp, '$1')
}

/**
 * 3:新增 对obj对象的一些属性进行恢复出厂设置
 * @param {*} fn 恢复值之后需要调用的函数
 * @param {*} obj 需要恢复值的对象
 * @param {*}  augments[i+2] obj需要恢复的属性
 */
function restore(fn, obj) {
  let props = new Array(arguments.length - 2)
  let vals = new Array(arguments.length - 2)

  // 保存函数调用时，obj对应属性的值
  for (let i = 0; i < props.length; i++) {
    props[i] = arguments[i + 2]
    vals[i] = obj[props[i]]
  }

  return function () {
    // 调用函数时，对obj属性值进行恢复
    for (let i = 0; i < props.length; i++) {
      obj[props[i]] = vals[i]
    }
    fn.apply(this, arguments);
  }

}
// 4:新增 增加router.methods对外接口
methods
  .forEach(function (method) {
    method = method.toLowerCase()
    proto[method] = function (path) {
      let route = this.route(path)
      route[method].apply(route, slice.call(arguments, 1))
      return this
    }
  })
