Package.describe({
  summary: 'Dynamically create and update templates and their data contexts.',
  version: "0.3.0",
  git: "https://github.com/eventedmind/iron-dynamic-template"
});

Package.on_use(function (api) {
  api.use('blaze@1.0.0');
  api.use('underscore@1.0.0');
  api.use('ui@1.0.0');
  api.use('jquery@1.0.0');
  api.use('deps@1.0.0');
  api.use('templating@1.0.0');

  api.use('iron:core@0.3.2');
  api.imply('iron:core');

  api.add_files('version_conflict_error.js');
  api.add_files('dynamic_template.js');
});

Package.on_test(function (api) {
  api.use('iron:dynamic-template');
  api.use('templating@1.0.0');
  api.use('tinytest@1.0.0');
  api.use('test-helpers@1.0.0');
  api.use('ui@1.0.0');
  api.use('deps@1.0.0');

  api.add_files('dynamic_template_test.html', 'client');
  api.add_files('dynamic_template_test.js', 'client');
});
