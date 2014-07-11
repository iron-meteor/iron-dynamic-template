if (Meteor.isClient) {
  Template.__define__("WithHelper", (function() {
    var view = this;
    return Spacebars.TemplateWith(function() {
      return {
        template: Spacebars.call(view.lookup("getTemplate")),
        data: Spacebars.call(view.lookup("getData"))
      };
    }, function() {
      return Spacebars.include(view.lookupTemplate("DynamicTemplate"));
    });
  }));

  Template.WithHelper.helpers({
    getTemplate: function () {
      return Session.get('tmpl');
    },

    getData: function () {
      return Session.get('data');
    }
  });

  var tmpl = Template.__create__('DynamicTemplateHelper', function () {
    var view = this;


    // do a deps autorun that says if the template has changed then invalidate
    // everything, but if it's just data what do we do? We need the ability to
    // distinguish arguments here.

    var lookupArg = (function (view) {
      var findData = function () {
        while (view) {
          if (view.kind === 'with' && view.__isTemplateWith)
            return view.dataVar.get();
          else
            view = view.parentView;
        }

        return null;
      };

      return function (key) {
        return function () {
          var data = findData();
          return data && data[key];
        };
      };
    })(view);

    return Blaze.With(function () {
      var data = lookupArg('data')();
      console.log('data: ' + data);
      return data;
    }, function () {
      var template = lookupArg('template')();
      console.log('template: ' + template);
      if (template)
        return Template[template];
      else
        return null;
    });
  });

  UI.registerHelper('DynamicTemplate', tmpl);
}
