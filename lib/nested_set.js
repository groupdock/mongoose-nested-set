/*globals require, console, module */

'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async');

var NestedSetPlugin = function(schema, options) {
  options = options || {};

  schema.add({ lft: {type: Number, min: 0} });
  schema.add({ rgt: {type: Number, min: 0} });
  schema.add({ parentId: {type: Schema.ObjectId} });

  schema.index({parentId: 1});
  schema.index({lft: 1, rgt: 1});
  schema.index({rgt: 1});

  schema.pre('save', function(next) {
    var self = this;
    if (self.parentId) {
      self.parent(function(err, parentNode) {
        if (!err && parentNode && parentNode.lft && parentNode.rgt) {

          // find siblings and check if they have lft and rgt values set
          self.siblings(function(err, nodes) {
            if (nodes.every(function(node) { return node.lft && node.rgt;})) {
              var maxRgt = 0;
              nodes.forEach(function(node) {
                if (node.rgt > maxRgt) {
                  maxRgt = node.rgt;
                }
              });
              if (nodes.length === 0) {
                // if it is a leaf node, the maxRgt should be the lft value of the parent
                maxRgt = parentNode.lft;
              }
              self.constructor.update({lft: { $gt: maxRgt}}, {$inc: {lft: 2}}, {multi: true}, function(err, updatedCount) {
                self.constructor.update({rgt: { $gt: maxRgt}}, {$inc: {rgt: 2}}, {multi: true}, function(err, updatedCount2) {
                  self.lft = maxRgt + 1;
                  self.rgt = maxRgt + 2;
                  next();
                });
              });
            } else {
              // the siblings do not have lft and rgt set. This means tree was not build.
              // warn on console and move on.
              // console.log('WARNING: tree is not built for ' + modelName + ' nodes. Siblings does not have lft/rgt');
              next();
            }
          });
        } else {
          // parent node does not have lft and rgt set. This means tree was not built.
          // warn on console and move on.
          // console.log('WARNING: tree is not built for ' + modelName + ' nodes. Parent does not have lft/rgt');
          next();
        }
      });
    } else {
      // no parentId is set, so ignore
      next();
    }
  });

  schema.pre('remove', function(next) {
    var self = this;
    if (self.parentId) {
      self.parent(function(err, parentNode) {
        if (!err && parentNode && parentNode.lft && parentNode.rgt) {

          // find siblings and check if they have lft and rgt values set
          self.siblings(function(err, nodes) {
            if (nodes.every(function(node) { return node.lft && node.rgt;})) {
              var maxRgt = 0;
              nodes.forEach(function(node) {
                if (node.rgt > maxRgt) {
                  maxRgt = node.rgt;
                }
              });
              if (nodes.length === 0) {
                // if it is a leaf node, the maxRgt should be the lft value of the parent
                maxRgt = parentNode.lft;
              }
              self.constructor.update({lft: { $gt: maxRgt}}, {$inc: {lft: -2}}, {multi: true}, function(err, updatedCount) {
                self.constructor.update({rgt: { $gt: maxRgt}}, {$inc: {rgt: -2}}, {multi: true}, function(err, updatedCount2) {
                  next();
                });
              });
            } else {
              // the siblings do not have lft and rgt set. This means tree was not build.
              // warn on console and move on.
              // console.log('WARNING: tree is not built for ' + modelName + ' nodes. Siblings does not have lft/rgt');
              next();
            }
          });
        } else {
          // parent node does not have lft and rgt set. This means tree was not built.
          // warn on console and move on.
          // console.log('WARNING: tree is not built for ' + modelName + ' nodes. Parent does not have lft/rgt');
          next();
        }
      });
    } else {
      // no parentId is set, so ignore
      next();
    }
  });

  // Builds the tree by populating lft and rgt using the parentIds
  schema.static('rebuildTree', function(parent, left, callback) {
    var self = this;
    parent.lft = left;
    parent.rgt = left + 1;

    self.find({parentId: parent._id}, function(err, children) {
      if (err) return callback(err);
      if (!children) return callback(new Error(self.constructor.modelName + ' not found'));

      if (children.length > 0) {
        async.forEachSeries(children, function(item, cb) {
          self.rebuildTree(item, parent.rgt, function() {
            parent.rgt = item.rgt + 1;
            self.update({_id: parent._id}, {lft: parent.lft, rgt: parent.rgt}, cb);
          });
        }, function(err) {
          callback();
        });
      } else {
        self.update({_id: parent._id}, {lft: parent.lft, rgt: parent.rgt}, callback);
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

  // returns the parent node
  schema.method('parent', function(callback) {
    var self = this;
    self.constructor.findOne({_id: self.parentId}, callback);
  });

  // Returns the list of ancestors + current node
  schema.method('selfAndAncestors', function(callback) {
    var self = this;
    self.constructor.where('lft').lte(self.lft).where('rgt').gte(self.rgt).exec(callback);
  });

  // Returns the list of ancestors
  schema.method('ancestors', function(callback) {
    var self = this;
    self.selfAndAncestors(function(err, nodes) {
      if (err) {
        callback(err, null);
      } else {
        var nodesMinusSelf = nodes.filter(function(node) { return self._id.toString() !== node._id.toString(); });
        callback(null, nodesMinusSelf);
      }
    });
  });

  // Returns the list of children
  schema.method('children', function(callback) {
    var self = this;
    self.constructor.find({parentId: self._id}, callback);
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
    self.constructor.where('lft').gte(self.lft).where('rgt').lte(self.rgt).exec(callback);
  });

  // Returns the list of descendants
  schema.method('descendants', function(callback) {
    var self = this;
    self.selfAndDescendants(function(err, nodes) {
      if (err) {
        callback(err, null);
      } else {
        var nodesMinusSelf = nodes.filter(function(node) { return self._id.toString() !== node._id.toString(); });
        callback(null, nodesMinusSelf);
      }
    });
  });

  // Returns the list of all nodes with the same parent + current node
  schema.method('selfAndSiblings', function(callback) {
    var self = this;
    self.constructor.find({parentId: self.parentId}, callback);
  });

  // Returns the list of all nodes with the same parent
  schema.method('siblings', function(callback) {
    var self = this;
    self.selfAndSiblings(function(err, nodes) {
      if (err) {
        callback(err, null);
      } else {
        var nodesMinusSelf = nodes.filter(function(node) { return self._id.toString() !== node._id.toString(); });
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
};

module.exports = exports = NestedSetPlugin;
