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
  // 如果走的不是examples中的get：/path 测试不通过;
  it('GET /path', (done) => {
    request
      .get('/path')
      .expect(200)
      .end((err, res) => {
        if (err) 
          return done(err)
        let json = JSON.parse(res.text)
        assert.equal(json.index, 1, 'didn`t visite the first route /path') // 查看是否调用了第一次的注册
        assert.equal(json.end, true, 'res is wrong') // 查看是否调用了第二次注册
        done()
      })
  })
  // 如果走的不是examples中的post：/post/path 测试不通过
  it('POST /post/path', (done) => {
    request
      .post('/post/path')
      .expect(200)
      .end((err, res) => {
        if (err) 
          return done(err)
        assert.equal(res.text, 'post path', 'res is wrong') // 根据response调用end方法时的输出为: post path
        done()
      })
  })

  // 测试get: /get 带query
  it('GET /get?test=once', (done) => {
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

  // 如果走的不是examples中的post：/user/:id/:name 测试不通过
  /* it('POST /user/12/user', (done) => {
    request
      .post('/user/12/user')
      .expect(200)
      .end((err, res) => {
        console.log(res)
        if (err) {
          if (err === 'error') {
            return done()
          }
        }
        done()
      })
  }) */

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
})
