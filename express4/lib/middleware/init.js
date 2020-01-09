/**
 * 每次请求初始之时对app，req，res进行赋值关联
 */
'use strict'

const setPrototypeOf = require('setprototypeof')

exports.init = function (app) {
  return function expressInit(req, res, next) {
    req.res = res
    res.req = req
    req.next = next
    setPrototypeOf(req, app.request)
    setPrototypeOf(res, app.response)

    res.locals = res.locals || Object.create(null)
    next()
  }
}