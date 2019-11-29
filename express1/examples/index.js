const express = require('../index.js')
const app = express()
app.listen(3000) // 启动端口为3000的服务
// localhost:3000/path 时调用
app.get('/path', function (req, res) {
  console.log('visite /test')
  res.end('path')
})
// localhost:3000/ 时调用
app.get('/', function (req, res) {
  console.log('visite /')
  res.end('root')
})

exports = module.exports = app