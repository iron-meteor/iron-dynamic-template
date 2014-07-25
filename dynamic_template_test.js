String.prototype.compact = function () {
  return this.trim().replace(/\s/g, '').replace(/\n/g, '');
};

var ReactiveVar = function (value) {
  this._value = value;
  this._dep = new Deps.Dependency;
};

ReactiveVar.prototype.get = function () {
  this._dep.depend();
  return this._value;
};

ReactiveVar.prototype.set = function (value) {
  if (value !== this._value) {
    this._value = value;
    this._dep.changed();
  }
};

ReactiveVar.prototype.clear = function () {
  this._value = null;
  this._dep = new Deps.Dependency;
};

// a reactive template variable we can use
var reactiveTemplate = new ReactiveVar;

// a reactive data variable we can use
var reactiveData = new ReactiveVar;

var withDiv = function (callback) {
  var el = document.createElement('div');
  document.body.appendChild(el);
  try {
    callback(el);
  } finally {
    document.body.removeChild(el);
  }
};

var withRenderedTemplate = function (template, callback) {
  withDiv(function (el) {
    template = _.isString(template) ? Template[template] : template;
    var range = Blaze.render(template);
    range.attach(el);
    Deps.flush();
    callback(el);
  });
};

Template.StaticData.helpers({
  getData: function () {
    return 'data';
  }
});

Template.Dynamic.helpers({
  getTemplate: function () {
    // like session.get
    return reactiveTemplate.get();
  }
});

Template.DynamicData.helpers({
  getData: function () {
    // like session.get
    return reactiveData.get();
  }
});

Template.DynamicParentData.helpers({
  getData: function () {
    var res = reactiveData.get();
    return res;
  }
});

Template.DynamicWithBlock.helpers({
  getTemplate: function () {
    // like session.get
    return reactiveTemplate.get();
  }
});

Tinytest.add('DynamicTemplate - Static rendering with no data', function (test) {
  withRenderedTemplate('Static', function (el) {
    test.equal(el.innerHTML.compact(), 'NoData');
  });
});

Tinytest.add('DynamicTemplate - Static rendering with nonreactive data helper', function (test) {
  withRenderedTemplate('StaticData', function (el) {
    test.equal(el.innerHTML.compact(), 'WithData-data');
  });
});

Tinytest.add('DynamicTemplate - Dynamic rendering with no data', function (test) {
  withRenderedTemplate('Dynamic', function (el) {
    // starts off empty
    test.equal(el.innerHTML.compact(), '');

    // change the reactive template variable
    reactiveTemplate.set('One');
    Deps.flush();

    // new template should be on the page
    test.equal(el.innerHTML.compact(), 'One');

    // change it again!
    reactiveTemplate.set('Two');
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'Two');

    // be a good citizen
    reactiveTemplate.clear();
  });
});

Tinytest.add('DynamicTemplate - Rendering with dynamic data', function (test) {
  var renderCount = 0;
  Template.WithData.rendered = function () {
    renderCount++;
  };

  reactiveData._value = 'init';

  withRenderedTemplate('DynamicData', function (el) {
    // we've rendered the template to the page
    test.equal(renderCount, 1);

    // but no data yet
    test.equal(el.innerHTML.compact(), 'WithData-init');

    // now set the data
    reactiveData.set('1');
    Deps.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-1');

    // now set the data again
    reactiveData.set('2');
    Deps.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-2');

    reactiveData.clear();
  });
});

Tinytest.add('DynamicTemplate - Rendering with dynamic parent data', function (test) {
  var renderCount = 0;
  Template.WithData.rendered = function () {
    renderCount++;
  };

  // star the data value off as an empty string so the template still renders
  reactiveData._value = 'init';

  withRenderedTemplate('DynamicParentData', function (el) {
    // we've rendered the template to the page
    test.equal(renderCount, 1);

    // but no data yet
    test.equal(el.innerHTML.compact(), 'WithData-init');

    // now set the data
    reactiveData.set('1');
    Deps.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-1');

    // now set the data again
    reactiveData.set('2');
    Deps.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-2');

    reactiveData.clear();
  });
});

/*
Tinytest.add('DynamicTemplate - Rendering inherits data correctly', function (test) {
  withRenderedTemplate('InheritedParentData', function (el) {
    test.equal(el.innerHTML.compact(), 'WithDataAndParentData-inner-outer');
  });
});
*/


Tinytest.add('DynamicTemplate - Block content', function (test) {
  withRenderedTemplate('DynamicWithBlock', function (el) {
    // block content should be rendered since we don't have a template yet
    test.equal(el.innerHTML.compact(), 'default');

    // now set a template
    reactiveTemplate.set('One');
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'One');

    // go back to the default
    reactiveTemplate.set(undefined);
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'default');
  });
});

Tinytest.add('DynamicTemplate - From JavaScript', function (test) {
  reactiveData._value = '1';

  var getData = function () {
    return reactiveData.get();
  };

  var tmpl = new Iron.DynamicTemplate({template: 'One', data: getData});

  // calling create() on the dynamic template creates and returns a new
  // View to be rendered.
  withRenderedTemplate(tmpl.create(), function (el) {
    test.equal(el.innerHTML.compact(), 'One');

    tmpl.template('WithData');
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'WithData-1');

    // make sure reactivity works with data
    reactiveData.set('2');
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'WithData-2');

    // now reset the data value completely
    tmpl.data('3');
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'WithData-3');

    reactiveData.clear();
  });
});

Tinytest.add('DynamicTemplate - default template', function (test) {
  var tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});

  // calling create() on the dynamic template creates and returns a new
  // UI.Component to be rendered.
  withRenderedTemplate(tmpl.create(), function (el) {
    test.equal(el.innerHTML.compact(), 'One', 'default template not set from options');

    tmpl.template('Two');
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'Two', 'default template not replaced');

    tmpl.template(false);
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'One', 'fallback to default');

    tmpl.template(null);
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'One', 'fallback to default');

    tmpl.template(undefined);
    Deps.flush();
    test.equal(el.innerHTML.compact(), 'One', 'fallback to default');
  });
});

Tinytest.add('DynamicTemplate - view lifecycle callbacks', function (test) {
  var tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});
  var calls = [];

  _.each(['onCreated', 'onMaterialized', 'onRendered', 'onDestroyed'], function (hook) {
    tmpl[hook](function (dynamicTemplate) {
      calls.push({
        name: hook,
        dynamicTemplate: dynamicTemplate,
        thisArg: this
      });
    });
  });

  // calling create() on the dynamic template creates and returns a new
  // UI.Component to be rendered.
  var call;
  withRenderedTemplate(tmpl.create(), function (el) {
    test.equal(calls.length, 3, 'onCreated, onMaterialized and onRendered');

    call = calls[0];
    test.equal(call.name, 'onCreated');
    test.instanceOf(call.dynamicTemplate, Iron.DynamicTemplate);
    test.instanceOf(call.thisArg, Blaze.View);

    call = calls[1];
    test.equal(call.name, 'onMaterialized');
    test.instanceOf(call.dynamicTemplate, Iron.DynamicTemplate);
    test.instanceOf(call.thisArg, Blaze.View);

    call = calls[2];
    test.equal(call.name, 'onRendered');
    test.instanceOf(call.dynamicTemplate, Iron.DynamicTemplate);
    test.instanceOf(call.thisArg, Blaze.View);

    tmpl.destroy();
    call = calls[3];
    test.equal(call.name, 'onDestroyed');
    test.instanceOf(call.dynamicTemplate, Iron.DynamicTemplate);
    test.instanceOf(call.thisArg, Blaze.View);
  });
});
