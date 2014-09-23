/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var assert = Iron.utils.assert;

/*****************************************************************************/
/* Private */
/*****************************************************************************/
findFirstLookupHostWithProperty = function (view, prop) {
  assert(view instanceof Blaze.View, "view must be a Blaze.View");

  var host;

  while (view) {
    if ((host = DynamicTemplate.getLookupHost(view)) && host[prop])
      return host;
    else
      view = view.parentView;
  }

  return undefined;
};

/*****************************************************************************/
/* Blaze Overrides */
/*****************************************************************************/
/**
 * Adds ability to inject lookup hosts into views that can participate in
 * property lookup. For example, iron:controller or iron:component could make
 * use of this to add methods into the lookup chain. If the property is found,
 * a function is returned that either returns the property value or the result
 * of calling the function (bound to the __lookupHost__).
 */
var origLookup = Blaze.View.prototype.lookup;
Blaze.View.prototype.lookup = function (name /*, args */) {
  var lookupHost = findFirstLookupHostWithProperty(Blaze.getView(), name);
  if (lookupHost) {
    return function callLookupHostProperty (/* args */) {
      var val = lookupHost[name];
      var args = [].slice.call(arguments);
      return (typeof val === 'function') ? val.apply(lookupHost, args) : val;
    }
  } else {
    return origLookup.apply(this, arguments);
  }
};
