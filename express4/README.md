
## 回顾
上次迭代主要是实现了app.param，app.use，以及req.query中参数的提取工作。内容较多，篇幅也较长。
## 实现目标
本次主要是完善router，实现错误处理中间件 和use更多用法实现。其实在上一次迭代的代码中已经完成了错误中间件的逻辑，但是由于上次迭代的篇幅较长，所以就放到这次的迭代中讲诉。对use则是加上了use子模块和router模块的实现。

## 项目结构
```javascript
express4
  |
  |-- lib
  |    |-- middleware // 中间件文件夹
  |    |    |-- query.js // 实现req.query提取的中间件
  |    |    |-- init.js // 新增 每次请求初始之时对app，req，res进行赋值关联
  |
  |    |-- router // 实现简化板的router
  |    |    |-- index.js // 实现路由的遍历等功能
  |    |    |-- layer.js // 装置path，method cb对应的关系
  |    |    |-- route.js // 将path和fn的关系实现一对多
  |    |-- express.js //负责实例化application对象
  |    |-- application.js //包裹app层
  |    |-- utils.js // 新增，目前只是用于query中间件的实现的所需的工具函数
  |
  |-- examples
  |    |-- index.js // express 实现的使用例子
  |
  |-- test
  |    |
  |    |-- index.js // 自动测试examples的正确性
  |
  |-- index.js //框架入口
  |-- package.json // node配置文件

```
## 问题分析
本次迭代主要是将router作为中间件暴露给用户，并且可以作为app.use的中间件使用。app本身也是中间件的一种，也可以被app.use使用。以及错误中间件的完善工作

### app.use 使用app 和 router作为中间件
```javascript
// 路由作为中间件
var router = express.Router();
router.get('/', function (req, res, next) {
  next();
});
app.use(router)

// app作为中间件
var subApp = express();
subApp.get('/', function (req, res, next) {
  next();
});
app.use(subApp)
```
以上是在官方文档上，router和子app分别作为中间件在app中的使用示例。其实在application和router的实现中，最重要的就是handle函数，整个程序的执行入口就在这两个函数当中，而这两个函数的参数就是req，res，next，本身就是一个中间件。因此在app.use实现过程中，做了一些小小的包装处理。

### 错误中间件
```javascript
app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})
```
错误处理是指如何表示同步和异步发生的捕获和处理错误。Express附带了一个默认的错误处理程序-->[finalhandler](https://www.npmjs.com/package/finalhandler)。如果您将错误传递给next()，并且没有在自定义错误处理程序中处理它，那么它将由内置的错误处理程序处理;错误将通过堆栈跟踪写入客户端。

## 数据结构


```javascript
 --------------                                     ----- ----------
| Application  | ------------------------------->   | params       |
|     |        |        ----- -------------         |   |-param    |
|     |-router | ----> |     | Layer       |        |   |-callbacks|
--------------        |  0  |   |-path     |        ----- ----------
 application          |     |   |-callbacks|           router
                      |-----|--------------|
                      |     | Layer        |
                      |  1  |   |-path     |
                      |     |   |-callbacks|
                      |-----|--------------|
                      |     | Layer        |
                      |  2  |   |-path     |
                      |     |   |-callbacks|
                      |-----|--------------|
                      | ... |   ...        |
                       ----- --------------
                            router
```
对于子app作为中间件的数据结构并未发生变化，只是对callback函数做了处理。而对于router作为中间件，callback就是router的handle函数。
## 代码解析
和上次迭代一样，在文件的注释中前面加了一个“迭代编号:新增”的字样，来表示此段代码是在此迭代中新增的。

### app.use
application.js中的use做了修改，主要是对子app的回调做个简单处理。引入[flatten](https://www.npmjs.com/package/flatten)处理一下use的参数，这个在其他的一些类似参数的接口中也加入了处理
```javascript
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
```
在上面的代码中有req.app的引用。这次在每次请求时出了原来的query中间件，还加入了一个init中间件，主要是对app，req，res进行赋值关联
```javascript
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
```
app.request是在程序初始化时加入的，并将app挂在在app.request上面。对应文件为express.js
```javascript
function createApplication() {
  ...
  // 4:新增 讲app和新创建的req相互关联
  app.request = Object.create(req, {
    app: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: app
    }
  })
  // 4:新增 讲app和新创建的res相互关联
  app.response = Object.create(res, {
    app: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: app
    }
  })
  app.init()
  return app
}
```
重点的实现在router的handle方法，主要是是将请求的链接进行分割。比如path:/sub/:id/getuser 实际是子app的基本路径为:/sub 而在子app中有注册get：/:id/getuser路由，两者连起来形成path：/sub/:id/getuser。所以在router的handle中，将url分割称两部分：/sub , /12/getuser
```javascript
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
      ...
    }
    if (match !== true) { // 循环完成没有匹配的路由，调用最终处理函数
      return done(layerError)
    }
    req.params = mixin(parentPrarms || {}, layer.params) // 将解析的‘/get/:id’ 中的id剥离出来
    // 4:新增
    let layerPath = layer.path

    // 3:新增，主要是处理app.param
    self.process_params(layer, paramcalled, req, res, function (err) {
      ...
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

```
对于错误中间件的处理，主要是放在layer.js中，当出现错误的时候，将error传给next，如果layerError存在就走错误逻辑
```javascript
// router
proto.handle = function handle(req, res, out) {
 ...
  next() //第一次调用next
  function next(err) {
    let layerError = err === 'route'
      ? null
      : err
    ...
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
   ...
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
    ...
    }
    if (layerError) {
      layer.handle_error(layerError, req, res, next)
    } else {
      layer.handle_request(req, res, next)
    }
  }
}

// layer
/**
 * 3:新增 加入handle_error的处理
 * @param {*} err 错误信息
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
Layer.prototype.handle_error = function handle_error(err, req, res, next) {
  let fn = this.handle
  if (fn.length !== 4) {
    return next(err)
  }
  try {
    fn(err, req, res, next)
  } catch (err) {
    next(err)
  }
}
```

exammple/index.js 在入口文件中加入了一些新的测试用例
```javascript

let router = express.Router({mergeParams: true})
router.get('/getname/:like', function (req, res, next) {
  res.end(JSON.stringify(req.params))
})
app.use('/:userId', router)
let subApp = express()
subApp.get('/getuser', function (req, res, next) {
  res.end(JSON.stringify(req.params))
})
app.use('/sub/:id', subApp)
```
test/index.js 测试exapmles中的代码，验证是否按照地址的不同，进了不同的回调函数

```javascript
// 4:新增 测试get: /:userId/getname/:like
  it('GET  /:userId/getname/:like', (done) => {
    request
      .get('/12/getname/ll')
      .expect(200)
      .end((err, res) => {
        if (err)
          return done(err)
        let params = JSON.parse(res.text)
        assert.equal(params.userId, '12', 'res.text must has prototype userId and the value must be 12') // 经过use方法处理后的test为once+ use = once use
        assert.equal(params.like, 'll', 'res.text must has prototype like and the value must be ll')
        done()
      })
  })

  // 4:新增 测试get: /:userId/getname/:like
  it('GET /sub/:id/getuser', (done) => {
    request
      .get('/sub/13/getuser')
      .expect(200)
      .end((err, res) => {
        if (err)
          return done(err)
        let params = JSON.parse(res.text)
        assert.equal(params.id, '16', 'res.text must has prototype id and the value must be 13')
        done()
      })
  })

```

test测试结果如下：


![](https://user-gold-cdn.xitu.io/2020/1/9/16f89aaa954d3e99?w=1014&h=534&f=png&s=51383)
## 回顾整体结构

## 写在最后
这节对应的逻辑相对来说比较简单，主要是对以前的逻辑进行完善处理。让router独立出来，可做中间件。让app亦可独立作为中间件应用于另一个app中。这样就形成了嵌套关系。这次迭代完成之后，算是把express的主要逻辑形成了一个完整的链条。之后的功能可以说是围绕当前的数据结构做存取，整体的数据结构不会发生大的变化。对于express的解读想暂时写到此，如果后面有时间，就写一下模版的渲染和req，res的封装。