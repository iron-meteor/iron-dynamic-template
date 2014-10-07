/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var assert = Iron.utils.assert;
var get = Iron.utils.get;

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
  //XXX we only want to create a dependency if we actually use the helper
  //from the host.
  var host = DynamicTemplate.findLookupHostWithHelper(Blaze.getView(), name);

  if (host) {
    //XXX if we follow this path, establish a dep on the host changing
    return function callLookupHostHelper (/* args */) {
      var helper = get(host, 'constructor', '_helpers', name);
      var args = [].slice.call(arguments);
      return (typeof helper === 'function') ? helper.apply(host, args) : helper;
    }
  } else {
    //XXX don't establish a dep if we follow this path.
    return origLookup.apply(this, arguments);
  }
};
