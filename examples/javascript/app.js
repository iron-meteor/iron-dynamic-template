if (Meteor.isClient) {
  Meteor.startup(function () {
    dynamic = new Iron.DynamicTemplate(/* {template: 'One', data: getData} */);  
    dynamic.insert({el: '#container'});
    dynamic.template('One');
    dynamic.data({title: 'World'});

    setTimeout(function () {
      dynamic.clear();
    }, 3000);
  });
}
