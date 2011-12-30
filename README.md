# mongoose-nested-set

A mongoose plugin implementing the nested set pattern for mongoose models

### Usage

```javascript
var mongoose = require('mongoose'),
    NestedSetPlugin = require('mongoose-nested-set'),
    Schema = mongoose.Schema;
    
mongoose.connect('mongodb://localhost/nested_set_test');

var UserSchema = new Schema({
  username: {type: String}
});

// Include plugin
UserSchema.plugin(NestedSetPlugin);

User = mongoose.model('User', UserSchema);
```

### Examples

Examples are based on the following tree:

![The Office](https://github.com/groupdock/mongoose-nested-set/raw/master/docs/test_tree.png "The Office")

```javascript
User.findOne({username: 'michael'}, function(err, michael) {
  User.rebuildTree(michael, 1, function() {
    // at this point, the tree is built and every node has a lft and rgt value.
    michael.descendants(function(err, data) {
      // data contains a list of michael descendants
      console.log(data);
    });
    console.log('Is Michael a leaf node?', michael.isLeaf());
    console.log('Is Michael a child node?', michael.isChild());
  });
});
```


### API

### Static methods

__Model.rebuildTree(rootNode, leftValueOfRootNode, callback)__

#### Instance methods that return values:

__isLeaf()__

__isChild()__

__isDescendantOf(otherNode)__

__isAncestorOf(otherNode)__


#### Instance methods that use a callback function:

__selfAndAncestors(callback)__

__ancestors(callback)__

__selfAndChildren(callback)__

__children(callback)__

__selfAndDescendants(callback)__

__descendants(callback)__

__level(callback)__

__selfAndSiblings(callback)__

__siblings(callback)__


### Related Links/Resources

* [Mongoose Documentation] (http://mongoosejs.com/)
* [Mongoose Plugins] (http://mongoosejs.com/docs/plugins.html)
* [Tree used in test and examples] (https://github.com/groupdock/mongoose-nested-set/raw/master/docs/test_tree.png)
* [Nested Set Model] (http://en.wikipedia.org/wiki/Nested_set_model)
* [Storing Hierarchical Data in a Database Article] (http://www.sitepoint.com/hierarchical-data-database/)
* [Trees in MongoDB] (http://www.mongodb.org/display/DOCS/Trees+in+MongoDB)

### Authors

* Luc Castera: [https://github.com/dambalah](https://github.com/dambalah)

### Sponsor

[Intellum] (http://www.intellum.com/)
