'use strict'

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async');

var NestedSetPlugin = function(schema, options) {
  options = options || {}

  var modelName = options.modelName || 'User';

  schema.add({ lft: {type: Number, min: 0} });
  schema.add({ rgt: {type: Number, min: 0} });
  schema.add({ parentId: {type: Schema.ObjectId} });
  
  schema.static('rebuildTree', function(parent, left, callback) {
    parent.lft = left;
    parent.rgt = left + 1;
    var model = mongoose.model(modelName);

    model.find({parentId: parent._id}, function(err, children) {
      if (err) return callback(err);
      if (!children) return callback(new Error(modelName + ' not found'));

      if (children.length > 0) {
        async.forEachSeries(children, function(item, cb) {
          model.rebuildTree(item, parent.rgt, function() {
            parent.rgt = item.rgt + 1;
            model.update({_id: parent._id}, {lft: parent.lft, rgt: parent.rgt}, cb);
          });
        }, function(err) {
          callback();
        });
      } else {
        model.update({_id: parent._id}, {lft: parent.lft, rgt: parent.rgt}, callback);
      }
    });
  });
}

module.exports = exports = NestedSetPlugin;
