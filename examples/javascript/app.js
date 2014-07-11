if (Meteor.isClient) {
  Meteor.startup(function () {
    dynamic = new Iron.DynamicTemplate(/* {template: 'One', data: getData} */);  
    dynamic.insert({el: '#container'});
    dynamic.template('One');

    setInterval(function () {
      dynamic.data({title: Random.id()});
    }, 2000);
  });
}
