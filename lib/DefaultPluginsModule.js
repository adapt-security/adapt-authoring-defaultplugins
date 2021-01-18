const { AbstractModule } = require('adapt-authoring-core');
/**
 * Add supplementary data to existing schemas which defines how and when data was authored
 * @extends {AbstractModule}
 */
class DefaultPluginsModule extends AbstractModule {
  async init() {
    const [content, plugins] = await this.app.waitForModule('content', 'contentPlugins');
    content.createHook.tap(async data => {
      if(data._type !== 'config') {
        return;
      }
      const defaultPlugins = await plugins.find({ isAddedByDefault: true });
      if(defaultPlugins.length) {
        return;
      }
      if(!data._enabledPlugins) data._enabledPlugins = [];
      defaultPlugins.forEach(({ name }) => !data._enabledPlugins.includes(name) && data._enabledPlugins.push(name));
    });
  }
}

module.exports = DefaultPluginsModule;
