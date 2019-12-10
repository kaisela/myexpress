'use strict'
/**
 * route 模块，存放管理path值一定时的method和callback的关系数组
 */

const debug = require('debug')('express:router:route')
const Layer = require('./layer')
let methods = require('http').METHODS

module.exports = Route

const toString = Object.prototype.toString;

/**
 * 采用设计模式中的工厂模式实现
 */

function Route(path) {
  this.path = path
  this.stack = [] //method fun对应数组,Layer实例
  this.methods = {}
}
/**
 * 对同一path对应的methods进行注册，存放入stack中
 */
methods.forEach((method) => {
  method = method.toLowerCase()

  Route.prototype[method] = function () {
    let handles = arguments

    for (let i = 0; i < handles.length; i++) {
      let handle = handles[i]
      if (typeof handle !== 'function') {
        let msg = `Route.${method}() requires a callback function but not a ${type}`
        throw new Error(msg)
      }

      debug('%s %o', method, this.path)

      let layer = new Layer('/', {}, handle)
      layer.method = method

      this.methods[method] = true
      this
        .stack
        .push(layer)
    }
    return this
  }
})

/**
 * 遍历stack数组，并处理函数
 */
Route.prototype.dispatch = function dispatch(err, req, res, done) {
  let idx = 0
  let stack = this.stack
  if (stack.length === 0) {
    return done() // 函数出来完成之后，将执行入口交给母函数管理
  }

  let method = req
    .method
    .toLowerCase()
  req.route = this
  next()
  function next() {
    console.log(idx)
    let layer = stack[idx++]
    if (!layer) {
      return done()
    }
    if (layer.method && layer.method !== method) {
      return next()
    }

    layer.handle_request(req, res, next)
  }

}
/**
 * 判断当前route实例是否有注册method方法
 */
Route.prototype._handles_method = function _handles_method(method) {
  return Boolean(this.methods[method.toLowerCase()])
}