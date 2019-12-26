const express = require('../index.js')
const app = express()
let pathJson = {}
app.listen(3000) // 启动端口为3000的服务
// localhost:3000/path 时调用
app.get('/path', function (req, res, next) {
  console.log('visite /path , send : path')
  // res.end('path')
  pathJson.index = 1
  next()
})
// localhost:3000/path 时调用，先走第一个，再走这个
app.get('/path', function (req, res) {
  pathJson.end = true
  res.end(JSON.stringify(pathJson))
})
// localhost:3000/ 时调用
app.get('/', function (req, res) {
  res.end('root')
})
// 发生post请求的时候调用
app.post('/post/path', function (req, res) {
  res.end('post path')
})
// 3:新增 输出传入的id，和name时拦截处理参数
app.param([
  'id', 'name'
], function (req, res, next, val, name) {
  if (name == 'id') {
    req.params.id = ((val - 0) + 3) + ''
  }
  if (name == 'name') {
    req.params[name] = req.params[name] + ' param'
  }
  next()
})
// 3:新增 当路径为/get 时拦截处理query
app.use('/get', function (req, res, next) {
  for (key in req.query) {
    req.query[key] = req.query[key] + ' use'
  }
  next()
})

// 测试param处理id ,name
app.post('/user/:id/:name', function (req, res) {
  res.end(JSON.stringify(req.params))
})

// 测试param处理id
app.post('/user/:id', function (req, res) {
  res.end(JSON.stringify(req.params))
})

// 测试param处理name
app.post('/name/:name', function (req, res) {
  res.end(JSON.stringify(req.params))
})

app.get('/get', function (req, res) {
  res.end(JSON.stringify(req.query))
})
exports = module.exports = app