Package.describe({
  name: 'iron-dynamic-template',
  summary: 'Dynamic templates and data contexts.',
  version: "0.1.0",
  githubUrl: "https://github.com/eventedmind/iron-dynamic-template"
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
  api.use('iron-dynamic-template');
  api.use('templating');
  api.use('tinytest');
  api.use('test-helpers');
  api.use('ui');

  api.add_files('dynamic_template_test.html', 'client');
  api.add_files('dynamic_template_test.js', 'client');
});
