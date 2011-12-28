'use strict'

var testCase = require('nodeunit').testCase,
    mongoose = require('mongoose'),
    NestedSetPlugin = require('../lib/nested_set'),
    Schema = mongoose.Schema,
    async = require('async'),
    Helpers = require('./helpers');

var UserSchema,
    User

var tests = testCase({
  setUp: function(next) {
    async.series([
      function(callback) {
        mongoose.connect('mongodb://localhost/nested_set_test');
        callback();
      },
      function(callback) {
        UserSchema = new Schema({
          username: {type: String}
        });
        UserSchema.plugin(NestedSetPlugin);
        User = mongoose.model('User', UserSchema);
        callback();
      },
      function(callback) {
        // drop users from mongodb
        User.remove({}, callback);
      },
      function(callback) {
        // see diagram in docs/test_tree.png for a representation of this tree
        var michael = new User({username: 'michael'});

        var meredith = new User({username: 'meredith', parentId: michael._id});
        var jim = new User({username: 'jim', parentId: michael._id});
        var angela = new User({username: 'angela', parentId: michael._id});

        var kelly = new User({username: 'kelly', parentId: meredith._id});
        var creed = new User({username: 'creed', parentId: meredith._id});

        var phyllis = new User({username: 'phyllis', parentId: jim._id});
        var stanley = new User({username: 'stanley', parentId: jim._id});
        var dwight = new User({username: 'dwight', parentId: jim._id});

        var oscar = new User({username: 'oscar', parentId: angela._id});

        async.forEach([
          michael,
          meredith,
          jim,
          angela,
          kelly,
          creed,
          phyllis,
          stanley,
          dwight,
          oscar
        ], function(item, cb) { item.save(cb) }, function(err) {
          callback();
        })
      },
      function(callback) {
        next();
      }
    ])
  },
  'is sane': function(test) {
    test.expect(3);
    test.ok(User);
    test.equal('function', typeof User);
    test.equal('User', User.modelName);
    test.done();
  },
  'has created users for testing': function(test) {
    test.expect(4);
    User.find(function(err, users) {
      if (err) { console.log(err); }
      test.ok(!err);
      test.ok(users);
      test.ok(users instanceof Array);
      test.equal(10, users.length);
      test.done();
    });
  },
  'can read parentIds as ObjectIDs': function(test) {
    User.find(function(err, users) {
      if (err) { console.log(err); }
      test.ok(!err);
      users.forEach(function(user) {
        if (user.parentId) {
          test.ok(Helpers.isObjectId(user.parentId));
        }
      });
      test.done();
    });
  },
  'rebuildTree should set lft and rgt based on parentIds': function(test) {
    User.findOne({username: 'michael'}, function(err, user) {
      User.rebuildTree(user, 1, function() {
        User.find(function(err, users) {
          // see docs/test_tree.png for the graphical representation of this tree with lft/rgt values
          users.forEach(function(person) {
            if (person.username === 'michael') {
              test.equal(1, person.lft);
              test.equal(20, person.rgt);
            } else if (person.username === 'meredith') {
              test.equal(2, person.lft);
              test.equal(7, person.rgt);
            } else if (person.username === 'jim') {
              test.equal(8, person.lft);
              test.equal(15, person.rgt);
            } else if (person.username === 'angela') {
              test.equal(16, person.lft);
              test.equal(19, person.rgt);
            } else if (person.username === 'kelly') {
              test.equal(3, person.lft);
              test.equal(4, person.rgt);
            } else if (person.username === 'creed') {
              test.equal(5, person.lft);
              test.equal(6, person.rgt);
            } else if (person.username === 'phyllis') {
              test.equal(9, person.lft);
              test.equal(10, person.rgt);
            } else if (person.username === 'stanley') {
              test.equal(11, person.lft);
              test.equal(12, person.rgt);
            } else if (person.username === 'dwight') {
              test.equal(13, person.lft);
              test.equal(14, person.rgt);
            } else if (person.username === 'oscar') {
              test.equal(17, person.lft);
              test.equal(18, person.rgt);
            }
          })
          test.done();
        })
      });
    });
  }
});

module.exports = tests;
