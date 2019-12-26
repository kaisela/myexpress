
## 回顾
上一次的迭代中，主要是实现了简化版的router，并对/get/:id 式的路由进行解析。同时实现app.Methods相应的接口
## 实现目标
本次迭代主要是实现了app.param，app.use，以及req.query中参数的提取工作。其实在本次迭代中app.param和query足以形成一个迭代，再加上app.use内容就比较多，不过我还是将它们放在一个迭代中，还请读者多费些时间去理解。因为理解到这一层了，express的真面目已经揭开一大半了

## 项目结构
```javascript
express3
  |
  |-- lib
  |    |-- middleware // 新增 中间件文件夹
  |    |    |-- query.js // 新增 实现req.query提取的中间件
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
## 重要概念引入
### 中间件
在express中，中间件其实是一个介于web请求来临后到调用处理函数前整个流程体系中间调用的组件。其本质是一个函数，内部可以访问修改请求和响应对象，并调整接下来的处理流程。

express官方给出的解释如下：
>Express 是一个自身功能极简，完全是由路由和中间件构成一个的 web 开发框架：从本质上来说，一个 Express 应用就是在调用各种中间件。
>
><i>中间件（Middleware)</i> 是一个函数，它可以访问请求对象（[request object](http://www.expressjs.com.cn/4x/api.html#req) (<span style='color:#e83e8c'>req</span>)）, 响应对象（[response object](http://www.expressjs.com.cn/4x/api.html#res) (<span style='color:#e83e8c'>res</span>)）, 和 web 应用中处于请求-响应循环流程中的中间件，一般被命名为 next 的变量。
>
>中间件的功能包括：
>
>- 执行任何代码。
>- 修改请求和响应对象。
>- 终结请求-响应循环。
>- 调用堆栈中的下一个中间件。
>
>如果当前中间件没有终结请求-响应循环，则必须调用 <span style='color:#e83e8c'>next() </span>方法将控制权交给下一个中间件，否则请求就会挂起。
>
>Express 应用可使用如下几种中间件：
>
>- [应用及中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.application)
>- [路由及中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.router)
>- [错误处理中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.error-handling)
>- [内置中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.built-in)
>- [第三方中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.third-party)
>
>使用可选则挂载路径，可在应用级别或路由级别装载中间件。另外，你还可以同时装在一系列中间件函数，从而在一个挂载点上创建一个子中间件栈。

所以对于迭代二来说Router和Route类中的<span style='color:#e83e8c'>this.stack</span>属性内部的每个handle都是一个中间件，根据使用接口不同区别了**应用级中间件**和**路由级中间件**，而四个参数的处理函数就是**错误处理中间件**，对于**内置中间件**我们暂时还未涉及，而app.use接口将要实现的就是嵌入**第三方中间件**

在express中的中间件其实和java中面相切面编程中的拦截器的作用基本一致。可以在某一类接口调用之前，使用中间件做统一处理。比如：app.param 也是一种中间件，只是它针对的只是对参数处理。而use和router都是针对请求路径来处理。

## 问题分析
本次迭代主要是实现了app.param，app.use，以及req.query中参数的提取工作

### app.use的官方api
```javascript
app.use(function(req, res, next) { // 将会拦截所有请求
  res.send('Hello World');
});
app.use('/abcd', function (req, res, next) { // 将会拦截路径为 /abcd 的请求
  next();
});
app.use('/abc?d', function (req, res, next) { // 将会拦截路径为 /abcd 和 /abd 的请求
  next();
});
app.use(/\/abc|\/xyz/, function (req, res, next) { // 将会拦截路径为 /abc 和 /xyz 的请求
  next();
});
```
以上为app.use的一些用法示例，由于use方法和router的参数很相似，只是少了method这个变量。所以在express的源码中，use方法注册的中间件的数据结构将使用router的第一层（Router）中的stack存储，只是use注册的Layer中少了route对象

### app.param的官方api
```javascript
app.param('id', function (req, res, next, id) { // 当注册路由为 .../:id/...形式时会被此中间件拦截
  console.log('CALLED ONLY ONCE');
  next();
});

app.param(['id', 'page'], function (req, res, next, value) { // 拦截含有id 或者 page参数的路由请求
  console.log('CALLED ONLY ONCE with', value);
  next();
});

// 以上两种方式的另一种写法，二者选其一 ，文中和测试用例中我们以上一种为例
app.param(function(param, option) {
  return function (req, res, next, val) {
    if (val == option) {
      next();
    }
    else {
      next('route');
    }
  }
});

// using the customized app.param()
app.param('id', 1337);

```
param的方法的结构就较为简单，分为参数param和callback两种，其二者的关系为一对多的关系，在express的源码中实现是放在Router类中，数据结构由params对象和_params数组两种方式存储，第一种书写方式只需要用到params对象，第二种书写方式则是后面所有的param注册，都是使用前面return的中间件函数。此文中对第二种书写方式不做详解，请自行看源码理解

Router中params的结构为{param:[fn,fn...]}

### req.query

主要是对请求路径中的query部分进行解析，主要使用的方法为parseurl，querystring.parse。url转换后的结构示例如下

url.parse (http://user:pass@host.com:8080/users/user.php?userName=Lulingniu&age=40&sex=male#namel1);
属性名 |值
---|---
href | http://user:pass@host.com:8080/users/user.php?userName=Lulingniu&age=40&sex=male#namel1
protocol | http
slashes | true
host | host.com:8080
auth|user:pass
hostname|host.com
port|8080
pathname|/users/user.php
search|?userName=Lulingniu&age=40&sex=male
path|/users/user.php?userName=Lulingniu&age=40&sex=male
query|userName=Lulingniu&age=40&sex=male
hash|#namel

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
对于query的实现，其实就是在所有路由注册前面加上了一个处理query的中间件，和中间件的结构图一样，只是这里的中间件是一个特定的函数
## 代码解析
此次迭代中新增的代码比较多，也比较零碎，因此我在文件的注释中前面加了一个“迭代编号:新增”的字样，来表示此段代码是在此迭代中新增的。

### app.use
application.js中新增use接口，主要是调用router中的use方法
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
  let fns = slice.call(arguments, offset)
  if (fns.length === 0) {
    throw new TypeError('app.use() require a middlewaare function')
  }

  this.lazyrouter()
  let router = this._router
  fns.forEach(function (fn) {
    router.use(path, fn)
  })
}
```
router中新增use方法，主要是完成对中间件的注册，在handle中遍历
```javascript
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

  let callbacks = slice.call(arguments, offset)
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
```

application.js中新增param接口，主要是调用router中的param方法
```javascript
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
```
router中新增param方法，主要是完成对param中间件的注册，在handle中处理
```javascript
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
```

router中的handle方法中新增对use中间件的遍历逻辑，主要是通过是否有route来判断。新增process_params方法对params对象的处理，主要是和layer.keys进行比较，匹配到的时候逐个执行param所对应的callbacks。在process_params中使用param递归遍历keys，使用paramCallback的递归对param对应的callbacks进行遍历。这里就不具体贴代码了，大家自行移步git看代码
```javascript
/**
 * 遍历stack数组，并处理函数, 将res req 传给route
 */

proto.handle = function handle(req, res, out) {
  ...
  next() //第一次调用next
  function next(err) {
    ...
    // 3:修改 对req调用handle时的初始值进行保存，返回处理函数，以便随时恢复初始值
      let done = restore(out, req, 'baseUrl', 'next', 'params')
    ...
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
      // 3:新增，原逻辑中不可能存在route没有的情况，在3中加入中间件，其route为undefined
      if (!route) {
        continue
      }
    ...
    }
    if (match !== true) { // 循环完成没有匹配的路由，调用最终处理函数
      return done(layerError)
    }
    req.params = Object.assign({}, layer.params) // 将解析的‘/get/:id’ 中的id剥离出来
    // 3:新增，主要是处理params
    self.process_params(layer, paramcalled, req, res, function (err) {
      if (err) {
        return next(layerError || err)
      }
      if (route) {
        //调用route的dispatch方法，dispatch完成之后在此调用next，进行下一次循环
        return layer.handle_request(req, res, next)
      }
      // 3:新增，加入handle_error处理
      trim_prefix(layer, layerError, '', path)
    })
  }

  function trim_prefix(layer, layerError, layerPath, path) {
    if (layerPath.length !== 0) {
      let c = path[layerPath.length]
      if (c && c !== '/' && c !== '.')
        return next(layerError)
    }
    if (layerError) {
      layer.handle_error(layerError, req, res, next)
    } else {
      layer.handle_request(req, res, next)
    }
  }

}
```
restore方法为一个高阶函数，主要作用是对一个对象的初始值进行存储，在返回的函数中以便随时恢复
```javascript
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
```
还有一个是query中间件介绍，在utils中通过compileQueryParser来确定querysting调用的是那个方法，默认值是在qs和querystring中做选择，当然你也可以自己写处理方法。在路由初始化的时候进行中间件的注册

```javascript

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
  }
}

/**
 * 3:新增 处理req.url query部分的中间件
 */
let merge = require('utils-merge')
let parseUrl = require('parseurl')
let qs = require('qs')

module.exports = function query(options) {
  let opts = merge({}, options)
  let queryparse = qs.parse

  if (typeof options === 'function') {
    queryparse = options
    opts = undefined
  }

  if (opts !== undefined && opts.allowPrototypes === undefined) {
    opts.allowPrototypes = true
  }

  return function query(req, res, next) {
    if (!req.query) {
      let val = parseUrl(req).query
      req.query = queryparse(val, opts)
    }
    next()
  }
}
```

exammple/index.js 在入口文件中加入了一些新的测试用例
```javascript
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
// 输出传入的id
app.get('/get/:id', function (req, res) {
  res.end(`{"id":${res.params.id}}`)
})
```
test/index.js 测试exapmles中的代码，验证是否按照地址的不同，进了不同的回调函数

```javascript

  // 测试get: /get 带query
  it('GET /get', (done) => {
    request
      .get('/get?test=once')
      .expect(200)
      .end((err, res) => {
        if (err)
          return done(err)
        let params = JSON.parse(res.text)
        assert.equal(params.test, 'once use', 'res.text must has prototype test and the value must be once use') // 经过use方法处理后的test为once+ use = once use
        done()
      })
  })

  // 如果走的不是examples中的post：/user/:id/:name 测试不通过
  it('POST /user/12/kaisela', (done) => {
    request
      .post('/user/12/kaisela')
      .expect(200)
      .end((err, res) => {
        if (err)
          return done(err)
        let params = JSON.parse(res.text)
        assert.equal(params.id, '15', 'id must be 15') // 经过param方法处理后的id为12+3 = 15
        assert.equal(params.name, 'kaisela param', 'name must be kaisela param')
        // 经过param方法处理后的id为kaisela+ param = kaisela param
        done()
      })
  })

  // 如果走的不是examples中的post：/user/:id测试不通过
  it('POST /user/17', (done) => {
    request
      .post('/user/17')
      .expect(200)
      .end((err, res) => {
        if (err)
          return done(err)
        let params = JSON.parse(res.text)
        // 经过param方法处理后的id为17+3 = 20
        assert.equal(params.id, '20', 'id must be 20')
        done()
      })
  })

  // 如果走的不是examples中的post：/name/:name测试不通过
  it('POST /name/ke', (done) => {
    request
      .post('/name/ke')
      .expect(200)
      .end((err, res) => {
        if (err)
          return done(err)
        let params = JSON.parse(res.text)
        // 经过param方法处理后的id为ke+ param = ke param
        assert.equal(params.name, 'ke param', 'name must be ke param')
        done()
      })
  })

```

test测试结果如下：


![](https://user-gold-cdn.xitu.io/2019/12/26/16f403740aa94a97?w=734&h=412&f=png&s=36079)

## 写在最后
到此为止，express的两个比较重要的功能算是基本完成，虽然还有很多细节要完善。对于use方法可以路由嵌套的功能也许还要花一个篇幅讲解，看后面的时间吧。还有request，response的封装，模版引擎以及错误处理中间件。尤其是模版引擎，目前算是一点未引入
## 下期预告
完善router，实现错误处理中间件 和use更多用法实现