import { AbstractModule }  from 'adapt-authoring-core';
/**
 * Add supplementary data to existing schemas which defines how and when data was authored
 * @extends {AbstractModule}
 */
export default class DefaultPluginsModule extends AbstractModule {
  /** @override */
  async init() {
    const [content, contentplugin] = await this.app.waitForModule('content', 'contentplugin');

    content.insertHook.tap(async (data, { schemaName }) => {
      if(schemaName !== 'config') {
        return;
      }
      const defaultPlugins = await contentplugin.find({ isAddedByDefault: true });
      if(!defaultPlugins.length) {
        return;
      }
      if(!data._enabledPlugins) data._enabledPlugins = [];
      defaultPlugins.forEach(({ name }) => !data._enabledPlugins.includes(name) && data._enabledPlugins.push(name));
    });
  }
}