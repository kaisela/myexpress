## 灵感

写这个的灵感主要源于github上WangZhechao早期写过的一篇关于express源码的文章，生完baby之后，本准备在其早期的代码上做一次升级解析。不成想居然和原作者想到一处去了，搭好戏台正准备开始干的时候，到原作者博客上一看，已经有升级版了。至此想以自己对express源码的理解，写一个关于express源码的系列，原作者的文章地址：https://github.com/WangZhechao/expross   感谢原作者的贡献
## 准备

项目以 mocha + chai + supertest 测试驱动开发，阅读者需要储备的知识有：

1、mocha作为测试框架在项目中的运用 https://mochajs.org

2、chai断言库的api使用 https://www.chaijs.com

3、使用supertest驱动服务器的启动，并模拟访问服务器地址。http://npm.taobao.org/package/supertest

4、node http服务端和客户端的基本知识 http://nodejs.cn/api/http.html#http_new_agent_options
## 实现目标
本系列项目和文章的目标是一步一步实现一个简化版的express，这就需要将express的源码进行一步一步的剥离。迭代一的目标是实现服务器的启动、app 对象get方法的简化版本以及项目基本结构的确定。对于get方法只实现到通过path找到对应的callback。path不做分解和匹配

## 项目结构
```jsvascript
express1
  |
  |-- lib
  |    |
  |    |-- express.js //负责实例化application对象
  |    |-- application.js //包裹app层
  |
  |-- examples
  |    |-- index.js // express1 实现的使用例子
  |
  |-- test
  |    |
  |    |-- index.js // 自动测试examples的正确性
  |
  |-- index.js //框架入口
  |-- package.json // node配置文件

```

## 执行流程
图片地址

https://user-gold-cdn.xitu.io/2019/11/29/16eb5be0c486c681?w=1618&h=694&f=png&s=117279
![](https://user-gold-cdn.xitu.io/2019/11/29/16eb5be0c486c681?w=1618&h=694&f=png&s=117279)

test/index.js 主要是集成mocha + chai + supertest 自动发送examples/index.js中注册的get请求。

examples/index.js 主要是对lib文件下的两个源码功能实现的验证。

lib/express.js 对application中的对象进行初始化，完成createServer方法的callback。

lib/application.js 一期迭代的主要功能和实现。主要实现了listen接口和get两个对外接口和handle供express.js 使用
## 代码解析
首先看看lib/application.js，代码中有_init, _defaultConfiguration, _set, handle, listen, get几个方法：

_init:  初始化app对象需要的一些基础设置

_defaultConfiguration: 设置环境变量env，后期迭代预留

_set: 对app中setting对象的操作，为后期迭代预留

handle: http.createServer 中的回调函数最终执行，遍历paths，确定调用哪个get函数中的回调函数

listen: 启动http服务。灵活使用arguments将http服务中listen方法的参数留给用户自行配置。同时createServer方法传入this，将在express.js中定义定app方法作为服务请求的回调函数。

get: 实现app的get接口，主要是对所有的get请求进行注册,存入app对象的paths数组中，方便handle中实现精准回调。

源码:
```javascript
'use strict'
/**
 * 采用的是设计模式中的模块模式，定义app对象，为其挂载方法
 */
const http = require('http')
let app = exports = module.exports = {}
/**
 * 初始化app对象需要的一些基础设置
 * paths: 存放所有使用get方法注册的请求，单体对象的格式为:
 * {
*     pathURL  请求的地址
      cb  请求对应的回调函数
 * }
 */
app._init = function init() {
  this.setting = {}
  this.paths = []
  this.defaultConfiguration()
}
/**
 * 设置环境变量env，后期迭代预留
 */
app._defaultConfiguration = function defaultConfiguration() {
  let env = process.env.NODE_ENV || 'development'
  this.set('env', env)
  this.set('jsonp callback name', 'callback')
}
/**
 * 对app中setting对象的操作，为后期迭代预留
 */
app._set = function set(key, val) {
  if (arguments.length === 1) {
    this.setting[key]
  }
  this.setting[key] = val
}
/**
 * http.createServer 中的回调函数最终执行，遍历paths，确定调用哪个get函数中的回调函数
 */
app.handle = function handle(req, res) {
  let pathURL = req.url
  for (let path of this.paths) {
    if (pathURL === path.pathURL) {
      path.cb(req, res)
    }
  }
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
app.get = function get(path, cb) {
  let pathObj = {
    pathURL: path,
    cb: cb
  }
  this
    .paths
    .push(pathObj)
}
```

exammple/index.js 启动服务，如果根据访问地址的不同，给出不同的输出
```javascript
const express = require('../index.js')
const app = express()
app.listen(3000) // 启动端口为3000的服务
// localhost:3000/path 时调用
app.get('/path', function (req, res) {
  console.log('visite /path , send : path')
  res.end('path')
})
// localhost:3000/ 时调用
app.get('/', function (req, res) {
  console.log('visite /, send: root')
  res.end('root')
})

exports = module.exports = app
```
test/index.js 测试exapmles中的代码，验证是否按照地址的不同，进了不同的回调函数

```javascript
'use strict'

const assert = require('chai').assert

const app = require('../examples/index.js')
const request = require('supertest')(app)
describe('服务器测试', () => {
  // 如果走的不是examples中的get：/ 测试不通过
  it('GET /', (done) => {
    request
      .get('/')
      .expect(200)
      .end((err, res) => {
        if (err)
          return done(err)
        assert.equal(res.text, 'root', 'res is wrong') // 根据response调用end方法时的输出为: root
        done()
      })
  })
  // 如果走的不是examples中的get：/path 测试不通过
  it('GET /path', (done) => {
    request
      .get('/path')
      .expect(200)
      .end((err, res) => {
        if (err)
          return done(err)
        assert.equal(res.text, 'path', 'res is wrong') // 根据response调用end方法时的输出为: path
        done()
      })
  })
})


```

test测试结果如下：
图片地址

https://user-gold-cdn.xitu.io/2019/11/29/16eb5f350d6cb502?w=1098&h=510&f=png&s=53188
![](https://user-gold-cdn.xitu.io/2019/11/29/16eb5f350d6cb502?w=1098&h=510&f=png&s=53188)

## 下期预告
先做个简单的尝试，下一期我们实现app的get，post等方法，主要是http中的methods，以及简单的路由处理。
