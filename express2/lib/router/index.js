'use strict'

const debug = require('debug')('router')
const Route = require('./route')
const Layer = require('./layer')
let methods = require('http').METHODS

const mixin = require('merge-descriptors')

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
  let url = req.url
  let done = out
  next() //第一次调用next
  function next(err) {
    let layerError = err === 'route'
      ? null
      : err
    if (layerError === 'router') { //如果错误存在，再当前任务结束前调用最终处理函数
      setImmediate(done, null)
      return
    }

    if (idx >= stack.length) { // 遍历完成之后调用最终处理函数
      setImmediate(done, layerError)
      return
    }

    let layer
    let match
    let route
    while (match !== true && idx < stack.length) { //从数组中找到匹配的路由
      layer = stack[idx++]
      match = matchLayer(layer, url)
      route = layer.route
      if (typeof match !== 'boolean') {
        layerError = layerError || match
      }

      if (match !== true) {
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
    res.params = Object.assign({}, layer.params) // 将解析的‘/get/:id’ 中的id剥离出来
    layer.handle_request(req, res, next) //调用route的dispatch方法，dispatch完成之后在此调用next，进行下一次循环

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