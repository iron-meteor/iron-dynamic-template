Package.describe({
  summary: 'Dynamic templates'
});

Package.on_use(function (api) {
  api.use('ui');
  api.use('spacebars');
  api.use('jquery')
  api.use('deps');
  api.use('templating');

  api.add_files('dynamic_template.js', 'client');
  api.export('Iron', 'client');
});

Package.on_test(function (api) {
  api.use('tinytest');
  api.use('test-helpers');
});
