/*****************************************************************************/
/* Imports */
/*****************************************************************************/
debug = Iron.utils.debug('iron:dynamic-template');
camelCase = Iron.utils.camelCase;

/*****************************************************************************/
/* Helpers */
/*****************************************************************************/
typeOf = function (value) {
  return Object.prototype.toString.call(value);
};

/*****************************************************************************/
/* DynamicTemplate */
/*****************************************************************************/

/**
 * Render a component to the page whose template and data context can change
 * dynamically, either from code or from helpers.
 *
 */
DynamicTemplate = function (options) {
  this.options = options = options || {};
  this._template = options.template;
  this._defaultTemplate = options.defaultTemplate;
  this._content = options.content;
  this._data = options.data;
  this._templateDep = new Deps.Dependency;
  this._dataDep = new Deps.Dependency;
  this._hasControllerDep = new Deps.Dependency;
  this._hooks = {};
  this._controller = new Blaze.ReactiveVar; 
  this.kind = options.kind || 'DynamicTemplate';

  // has the Blaze.View been created?
  this.isCreated = false;

  // has the Blaze.View been destroyed and not created again?
  this.isDestroyed = false;
};

/**
 * Get or set the template. 
 */
DynamicTemplate.prototype.template = function (value) {
  if (arguments.length === 1 && value !== this._template) {
    this._template = value;
    this._templateDep.changed();
    return;
  }

  if (arguments.length > 0)
    return;

  this._templateDep.depend();

  // do we have a template?
  if (this._template)
    return (typeof this._template === 'function') ? this._template() : this._template;

  // no template? ok let's see if we have a default one set
  if (this._defaultTemplate)
    return (typeof this._defaultTemplate === 'function') ? this._defaultTemplate() : this._defaultTemplate;
};

/**
 * Get or set the default template.
 *
 * This function does not change any dependencies.
 */
DynamicTemplate.prototype.defaultTemplate = function (value) {
  if (arguments.length === 1)
    this._defaultTemplate = value;
  else
    return this._defaultTemplate;
};


/**
 * Clear the template and data contexts.
 */
DynamicTemplate.prototype.clear = function () {
  //XXX do we need to clear dependencies here too?
  this._template = undefined;
  this._data = undefined;
  this._templateDep.changed();
};


/**
 * Get or set the data context.
 */
DynamicTemplate.prototype.data = function (value) {
  if (arguments.length === 1 && value !== this._data) {
    this._data = value;
    this._dataDep.changed();
    return;
  }

  this._dataDep.depend();
  return typeof this._data === 'function' ? this._data() : this._data;
};

/**
 * Create the view if it hasn't been created yet.
 */
DynamicTemplate.prototype.create = function (options) {
  var self = this;

  if (this.isCreated) {
    throw new Error("DynamicTemplate view is already created");
  }

  this.isCreated = true;
  this.isDestroyed = false;

  var templateVar = Blaze.ReactiveVar(null);

  var view = Blaze.View('DynamicTemplate', function () {
    var thisView = this;
    var template = templateVar.get();

    return Blaze.With(function () {
      debug(self.kind + " <region: " + (self._region || "none") + "> data computation: " + Deps.currentComputation._id);
      // NOTE: This will rerun anytime the data function invalidates this
      // computation OR if created from an inclusion helper (see note below) any
      // time any of the argument functions invlidate the computation. For
      // example, when the template changes this function will rerun also. But
      // it's probably generally ok. The more serious use case is to not
      // re-render the entire template every time the data context changes.
      var result = self.data();

      if (typeof result !== 'undefined')
        // looks like data was set directly on this dynamic template
        return result;
      else
        // return the first parent data context that is not inclusion arguments
        return DynamicTemplate.getParentDataContext(thisView);
    }, function () {
      // NOTE: When DynamicTemplate is used from a template inclusion helper
      // like this {{> DynamicTemplate template=getTemplate data=getData}} the
      // function below will rerun any time the getData function invalidates the
      // argument data computation. BUT, Spacebars.include will only re-render
      // the template if the template has actually changed. This is why we use
      // Spacebars.include here: To create a computation, and to only re-render
      // if the template changes.
      debug(self.kind + " <region: " + (self._region || "none") + "> spacebars include: " + Deps.currentComputation._id);

      var tmpl = null;

      // is it a template name like "MyTemplate"?
      if (typeof template === 'string') {
        tmpl = Template[template];

        if (!tmpl)
          // as a fallback double check the user didn't actually define
          // a camelCase version of the template.
          tmpl = Template[camelCase(template)];

        if (!tmpl)
          throw new Error("Couldn't find a template named " + JSON.stringify(template) + " or " + JSON.stringify(camelCase(template))+ ". Are you sure you defined it?");
      } else if (typeOf(template) === '[object Object]') {
        // or maybe a view already?
        tmpl = template;
      } else if (typeof self._content !== 'undefined') {
        // or maybe its block content like 
        // {{#DynamicTemplate}}
        //  Some block
        // {{/DynamicTemplate}}
        tmpl = self._content;
      }

      return tmpl;
    });
  });

  view.onCreated(function () {
    this.autorun(function () {
      templateVar.set(self.template());
    });
  });

  // wire up the view lifecycle callbacks
  _.each(['onCreated', 'onMaterialized', 'onRendered', 'onDestroyed'], function (hook) {
    view[hook](function () {
      // "this" is the view instance
      self._runHooks(hook, this);
    });
  });

  view.onMaterialized(function () {
    // avoid inserting the view twice by accident.
    self.isInserted = true;
  });

  this.view = view;
  view.__dynamicTemplate__ = this;
  view.kind = this.kind;
  return view;
};

/**
 * Destroy the dynamic template, also destroying the view if it exists.
 */
DynamicTemplate.prototype.destroy = function () {
  if (this.isCreated) {
    Blaze.destroyView(this.view);
    this.view = null;
    this.isDestroyed = true;
    this.isCreated = false;
  }
};

/**
 * View lifecycle hooks.
 */
_.each(['onCreated', 'onMaterialized', 'onRendered', 'onDestroyed'], function (hook) {
  DynamicTemplate.prototype[hook] = function (cb) {
    var hooks = this._hooks[hook] = this._hooks[hook] || [];
    hooks.push(cb);
    return this;
  };
});

DynamicTemplate.prototype._runHooks = function (name, view) {
  var hooks = this._hooks[name] || [];
  var hook;

  for (var i = 0; i < hooks.length; i++) {
    hook = hooks[i];
    // keep the "thisArg" pointing to the view, but make the first parameter to
    // the callback teh dynamic template instance.
    hook.call(view, this);
  }
};

/**
 * Insert the Layout view into the dom.
 */
DynamicTemplate.prototype.insert = function (options) {
  options = options || {};

  if (this.isInserted)
    return;
  this.isInserted = true;

  var el = options.el || document.body;
  var $el = $(el);

  if ($el.length === 0)
    throw new Error("No element to insert layout into. Is your element defined? Try a Meteor.startup callback.");

  if (!this.view)
    this.create(options);

  if (!this.range)
    this.range = Blaze.render(this.view, options.parentView);

  this.range.attach($el[0], options.nextNode);
  return this;
};

/**
 * Reactively return the value of the current controller.
 */
DynamicTemplate.prototype.getController = function () {
  return this._controller.get();
};

/**
 * Set the reactive value of the controller.
 */
DynamicTemplate.prototype.setController = function (controller) {
  var didHaveController = !!this._hasController;
  this._hasController = (typeof controller !== 'undefined');

  if (didHaveController !== this._hasController)
    this._hasControllerDep.changed();

  return this._controller.set(controller);
};

/**
 * Reactively returns true if the template has a controller and false otherwise.
 */
DynamicTemplate.prototype.hasController = function () {
  this._hasControllerDep.depend();
  return this._hasController;
};

/*****************************************************************************/
/* DynamicTemplate Static Methods */
/*****************************************************************************/

/**
 * Get the first parent data context that are not inclusion arguments
 * (see above function). Note: This function can create reactive dependencies.
 */
DynamicTemplate.getParentDataContext = function (view) {
  // start off with the parent.
  view = view.parentView;

  while (view) {
    if (view.kind === 'with' && !view.__isTemplateWith)
      return view.dataVar.get();
    else
      view = view.parentView;
  }

  return null;
};


/**
 * Get inclusion arguments, if any, from a view.
 *
 * Uses the __isTemplateWith property set when a parent view is used
 * specificially for a data context with inclusion args.
 *
 * Inclusion arguments are arguments provided in a template like this:
 * {{> yield "inclusionArg"}}
 * or
 * {{> yield region="inclusionArgValue"}}
 */
DynamicTemplate.getInclusionArguments = function (view) {
  var parent = view && view.parentView;

  if (!parent)
    return null;

  if (parent.__isTemplateWith && parent.kind === 'with')
    return parent.dataVar.get();

  return null;
};

/**
 * Given a view, return a function that can be used to access argument values at
 * the time the view was rendered. There are two key benefits:
 *
 * 1. Save the argument data at the time of rendering. When you use lookup(...)
 *    it starts from the current data context which can change.
 * 2. Defer creating a dependency on inclusion arguments until later.
 *
 * Example:
 *
 *   {{> MyTemplate template="MyTemplate"
 *   var args = DynamicTemplate.args(view);
 *   var tmplValue = args('template');
 *     => "MyTemplate"
 */
DynamicTemplate.args = function (view) {
  return function (key) {
    var data = DynamicTemplate.getInclusionArguments(view);

    if (data) {
      if (key)
        return data[key];
      else
        return data;
    }

    return null;
  };
};

/*****************************************************************************/
/* UI Helpers */
/*****************************************************************************/
UI.registerHelper('DynamicTemplate', Template.__create__('DynamicTemplateHelper', function () {
  var args = DynamicTemplate.args(this);

  return new DynamicTemplate({
    data: function () { return args('data'); },
    template: function () { return args('template'); },
    content: this.templateContentBlock
  }).create();
}));

/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.DynamicTemplate = DynamicTemplate;
