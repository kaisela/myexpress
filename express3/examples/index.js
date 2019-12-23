const express = require('../index.js')
const app = express()
let pathJson = {}
app.listen(3000) // 启动端口为3000的服务
// localhost:3000/path 时调用
/* app.get('/path', function (req, res, next) {
  console.log('visite /path , send : path')
  // res.end('path')
  pathJson.index = 1
  next()
})
// localhost:3000/path 时调用，先走第一个，再走这个
app.get('/path', function (req, res) {
  console.log('visite /path , send : path')
  pathJson.end = true
  res.end(JSON.stringify(pathJson))
})
// localhost:3000/ 时调用
app.get('/', function (req, res) {
  console.log('visite /, send: root')
  res.end('root')
})
// 发生post请求的时候调用
app.post('/post/path', function (req, res) {
  res.end('post path')
}) */
// 输出传入的id
/* app.param([
  'id', 'ss'
], function (req, res, next, val, name) {
  console.log(`${name}: ${val}`)
  next()
}) */
app.get('/get', function (req, res) {
  res.end(`{"id": ${req.query.id}}`)
})
exports = module.exports = app