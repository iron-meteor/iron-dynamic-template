typeOf = function (value) {
  return Object.prototype.toString.call(value);
};

findComponentWithProp = function (id, comp) {
  while (comp) {
    if (typeof comp[id] !== 'undefined')
      return comp;
    comp = comp.parent;
  }
  return null;
};

/**
 * Get inclusion arguments if any.
 *
 * Uses the __isTemplateWith property set when a parent component is used
 * specificially for a data context with inclusion args.
 *
 * Inclusion arguments are arguments provided in a template like this:
 * {{> yield "inclusionArg"}}
 * or
 * {{> yield region="inclusionArgValue"}}
 */
getInclusionArguments = function (cmp) {
  var parent = cmp && cmp.parent;

  if (!parent)
    return null;

  if (parent.__isTemplateWith && parent.data)
    return (typeof parent.data === 'function') ? parent.data() : parent.data;

  return null;
};

/**
 * Get the first parent data context that does not include inclusion arguments
 * (see above function).
 */
getParentDataContext = function (cmp) {
  // start off with the parent.
  cmp = cmp.parent;

  while (cmp) {
    if (!cmp.__isTemplateWith && cmp.data)
      return (typeof cmp.data === 'function') ? cmp.data() : cmp.data;
    else
      cmp = cmp.parent;
  }

  return null;
};

/**
 * Render a component to the page whose template and data context can change
 * dynaimcally.
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
  this.kind = options.kind || 'DynamicTemplate';
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
 * Return a UI.Component.
 */
DynamicTemplate.prototype.create = function (options) {
  var self = this;

  return UI.Component.extend({
    kind: self.kind,

    /**
     * Return either the data which is set on the dynamic template directly, or the next
     * ancestor's data.
     */
    data: function () {
      var result = self.data();
      var component = self.component;

      if (typeof result !== 'undefined')
        // looks like data was set directly on this dynamic template
        return result;
      else
        // return the first parent data context that is not inclusion arguments
        return getParentDataContext(component);
    },

    render: function () {

      // we assign the component at render time so it's available in the data
      // function.
      self.component = this;

      // so we can get back to the dynamic template instance.
      this.__dynamicTemplate__ = self;

      // Set up a reactive computation for template changes.
      return Spacebars.include(function () {
        var template = self.template();

        // is it a template name like "MyTemplate"?
        if (typeof template === 'string') {
          var tmpl = Template[template];

          if (!tmpl)
            throw new Error("Couldn't find a template named '" + template + "'. Are you sure you defined it?");

          return tmpl;
        }

        // or maybe a component?
        if (typeOf(template) === '[object Object]')
          return template;

        // or maybe its block content like 
        // {{#DynamicTemplate}}
        //  Some block
        // {{/DynamicTemplate}}
        if (typeof self._content !== 'undefined')
          return self._content;

        // guess we don't have a template assigned yet
        return null;
      });
    }
  });
};

/*
 * Create a new component and call UI.render.
 */
DynamicTemplate.prototype._render = function (options) {
  options = options || {};

  if (this.component)
    throw new Error("component is already rendered");

  var component = this.create();

  UI.render(component, options.parentComponent, options);

  if (!this.component)
    throw new Error("component should be assigned by now");

  return this.component;
};

/**
 * Insert the Layout component into the dom.
 */
DynamicTemplate.prototype.insert = function (options) {
  options = options || {};

  var el = options.el || document.body;
  var $el = $(el);

  if ($el.length === 0)
    throw new Error("No element to insert layout into. Is your element defined? Try a Meteor.startup callback.");

  UI.insert(this._render(options), $el[0], options.nextNode);
};

/**
 * Register a global helper so users can use DynamicTemplates directly.
 *
 * NOTE: I add a component as the value instead of a function to avoid creating
 * an unnecessary reactive dependency that Meteor creates when a global helper
 * is a function. If it's an object this dependency does not get created.
 */
UI.registerHelper('DynamicTemplate', UI.Component.extend({
  render: function () {
    // this.lookup will find the first component in the hierarchy with a data
    // property and then call into that data property, returning the value of
    // the property name once you call that function later. But it doesn't tell
    // us how many levels up in the heirarchy it was found!
    var template = new DynamicTemplate({
      template: this.lookup('template'),
      data: this.lookup('data'),
      content: this.__content
    });

    return template.create();
  }
}));

/**
 * Namespacing
 */
Iron = Iron || {};
Iron.DynamicTemplate = DynamicTemplate;

