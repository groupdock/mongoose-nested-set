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
  
  
  // Builds the tree by populating lft and rgt using the parentIds
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

  // Returns true if the node is a leaf node (i.e. has no children)
  schema.method('isLeaf', function() {
    return this.lft && this.rgt && (this.rgt - this.lft === 1);
  });
  
  // Returns true if the node is a child node (i.e. has a parent)
  schema.method('isChild', function() {
    return !!this.parentId;
  });
  
  // Returns true if other is a descendant of self
  schema.method('isDescendantOf', function(other) {
    var self = this;
    return other.lft < self.lft && self.lft < other.rgt;
  });
  
  // Returns true if other is an ancestor of self
  schema.method('isAncestorOf', function(other) {
    var self = this;
    return self.lft < other.lft && other.lft < self.rgt;
  });
  
  // Returns the list of ancestors + current node
  schema.method('selfAndAncestors', function(callback) {
    var self = this;
    var model = mongoose.model(modelName);
    model.where('lft').lte(self.lft).where('rgt').gte(self.rgt).run(callback);
  });
  
  // Returns the list of ancestors
  schema.method('ancestors', function(callback) {
    var self = this;
    self.selfAndAncestors(function(err, nodes) {
      if (err) {
        callback(err, null);
      } else {
        var nodesMinusSelf = nodes.filter(function(node) { return self.username != node.username });
        callback(null, nodesMinusSelf);
      }
    });
  });
  
  // Returns the list of children
  schema.method('children', function(callback) {
    var self = this;
    var model = mongoose.model(modelName);
    model.find({parentId: self._id}, callback);
  });

  // Returns the list of children + current node
  schema.method('selfAndChildren', function(callback) {
    var self = this;
    self.children(function(err, nodes) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, nodes.concat([self]));
      }
    });
  });

  // Returns the list of descendants + current node
  schema.method('selfAndDescendants', function(callback) {
    var self = this;
    var model = mongoose.model(modelName);
    model.where('lft').gte(self.lft).where('rgt').lte(self.rgt).run(callback);
  });
  
  // Returns the list of descendants
  schema.method('descendants', function(callback) {
    var self = this;
    self.selfAndDescendants(function(err, nodes) {
      if (err) {
        callback(err, null);
      } else {
        var nodesMinusSelf = nodes.filter(function(node) { return self.username != node.username });
        callback(null, nodesMinusSelf);
      }
    });
  });
  
  // Returns the list of all nodes with the same parent + current node
  schema.method('selfAndSiblings', function(callback) {
    var self = this;
    var model = mongoose.model(modelName);
    model.find({parentId: self.parentId}, callback);
  });
  
  // Returns the list of all nodes with the same parent
  schema.method('siblings', function(callback) {
    var self = this;
    self.selfAndSiblings(function(err, nodes) {
      if (err) {
        callback(err, null);
      } else {
        var nodesMinusSelf = nodes.filter(function(node) { return self.username != node.username });
        callback(null, nodesMinusSelf);
      }
    });
  });

  // Returns the level of this object in the tree. Root level is 0
  schema.method('level', function(callback) {
    var self = this;
    self.ancestors(function(err, nodes) {
      callback(err, nodes.length);
    });
  });
}

module.exports = exports = NestedSetPlugin;
