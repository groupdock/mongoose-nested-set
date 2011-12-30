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

var User = mongoose.model('User', UserSchema);
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

For more examples, see our [test suite] (https://github.com/groupdock/mongoose-nested-set/blob/master/tests/nested_set_test.js).

### API

### Static methods

* Model.rebuildTree(rootNode, leftValueOfRootNode, callback)

#### Instance methods that return values:

The following methods return a boolean:

* isLeaf()

* isChild()

* isDescendantOf(otherNode)

* isAncestorOf(otherNode)


#### Instance methods that use a callback function:

The following methods must be used with a callback. The callback method will be called with two arguments: the first argument is the error object (if there was no error, it will be null) and the second argument is the data returned.

* selfAndAncestors(callback)

* ancestors(callback)

* selfAndChildren(callback)

* children(callback)

* selfAndDescendants(callback)

* descendants(callback)

* level(callback)

* selfAndSiblings(callback)

* siblings(callback)


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
