'use strict'

var testCase = require('nodeunit').testCase,
    mongoose = require('mongoose'),
    NestedSetPlugin = require('../lib/nested_set'),
    Schema = mongoose.Schema,
    Step = require('step'),
    Helpers = require('./helpers');

var UserSchema,
    User

var tests = testCase({
  setUp: function(callback) {
    Step(
      function() {
        mongoose.connect('mongodb://localhost/nested_set_test');
        this();
      },
      function() {
        UserSchema = new Schema({
          username: {type: String}
        });
        UserSchema.plugin(NestedSetPlugin);
        User = mongoose.model('User', UserSchema);
        this();
      },
      function() {
        // drop users from mongodb
        User.remove({}, this);
      },
      function() {
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

        michael.save(this.parallel());
        meredith.save(this.parallel());
        jim.save(this.parallel());
        angela.save(this.parallel());
        kelly.save(this.parallel());
        creed.save(this.parallel());
        phyllis.save(this.parallel());
        stanley.save(this.parallel());
        dwight.save(this.parallel());
        oscar.save(this.parallel());
      },
      function(err) {
        if (err) { console.log(err); }
        callback();
      }
    )
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
  }
});

module.exports = tests;
