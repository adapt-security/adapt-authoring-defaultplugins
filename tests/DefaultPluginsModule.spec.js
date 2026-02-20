import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Hook from 'adapt-authoring-core/lib/Hook.js'

/**
 * Creates a mock app with configurable content and contentplugin modules.
 * The preInsertHook is a mutable series Hook so tapped observers can mutate data.
 */
function createMockApp (overrides = {}) {
  const preInsertHook = new Hook({ mutable: true })
  const content = { preInsertHook, ...overrides.content }
  const contentplugin = {
    find: async () => [],
    ...overrides.contentplugin
  }
  return {
    waitForModule: async () => [content, contentplugin],
    dependencyloader: {
      moduleLoadedHook: { tap: () => {}, untap: () => {} }
    },
    ...overrides.app,
    _content: content,
    _contentplugin: contentplugin
  }
}

/**
 * Helper to import and instantiate DefaultPluginsModule.
 * Returns the module instance and the mock app references.
 */
async function createModule (overrides = {}) {
  const { default: DefaultPluginsModule } = await import('../lib/DefaultPluginsModule.js')
  const app = createMockApp(overrides)
  const module = new DefaultPluginsModule(app, { name: 'adapt-authoring-defaultplugins' })
  await module.onReady()
  return { module, app, preInsertHook: app._content.preInsertHook }
}

describe('DefaultPluginsModule', () => {
  describe('constructor', () => {
    it('should be an instance of AbstractModule', async () => {
      const { AbstractModule } = await import('adapt-authoring-core')
      const { module } = await createModule()
      assert.ok(module instanceof AbstractModule)
    })

    it('should set the module name from pkg', async () => {
      const { module } = await createModule()
      assert.equal(module.name, 'adapt-authoring-defaultplugins')
    })
  })

  describe('#init()', () => {
    it('should call waitForModule with content and contentplugin', async () => {
      let waitForModuleArgs
      const app = {
        waitForModule: async (...args) => {
          waitForModuleArgs = args
          const preInsertHook = new Hook({ mutable: true })
          return [{ preInsertHook }, { find: async () => [] }]
        },
        dependencyloader: {
          moduleLoadedHook: { tap: () => {}, untap: () => {} }
        }
      }
      const { default: DefaultPluginsModule } = await import('../lib/DefaultPluginsModule.js')
      const module = new DefaultPluginsModule(app, { name: 'test' })
      await module.onReady()
      assert.deepEqual(waitForModuleArgs, ['content', 'contentplugin'])
    })

    it('should tap into the content preInsertHook', async () => {
      const { preInsertHook } = await createModule()
      assert.equal(preInsertHook.hasObservers, true)
    })

    it('should become ready after init completes', async () => {
      const { module } = await createModule()
      assert.equal(module._isReady, true)
    })
  })

  describe('preInsertHook callback', () => {
    describe('when schemaName is not config', () => {
      it('should not modify data for non-config schemas', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-a' }]
          }
        })
        const data = {}
        await preInsertHook.invoke(data, { schemaName: 'course' })
        assert.equal(data._enabledPlugins, undefined)
      })

      it('should not modify data for article schema', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-a' }]
          }
        })
        const data = { _enabledPlugins: ['existing'] }
        await preInsertHook.invoke(data, { schemaName: 'article' })
        assert.deepEqual(data._enabledPlugins, ['existing'])
      })
    })

    describe('when schemaName is config', () => {
      it('should add default plugins to _enabledPlugins', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-a' }, { name: 'plugin-b' }]
          }
        })
        const data = {}
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.deepEqual(data._enabledPlugins, ['plugin-a', 'plugin-b'])
      })

      it('should create _enabledPlugins array if it does not exist', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-a' }]
          }
        })
        const data = {}
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.ok(Array.isArray(data._enabledPlugins))
        assert.deepEqual(data._enabledPlugins, ['plugin-a'])
      })

      it('should append to existing _enabledPlugins', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-b' }]
          }
        })
        const data = { _enabledPlugins: ['plugin-a'] }
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.deepEqual(data._enabledPlugins, ['plugin-a', 'plugin-b'])
      })

      it('should not duplicate plugins already in _enabledPlugins', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-a' }, { name: 'plugin-b' }]
          }
        })
        const data = { _enabledPlugins: ['plugin-a'] }
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.deepEqual(data._enabledPlugins, ['plugin-a', 'plugin-b'])
      })

      it('should not modify _enabledPlugins when no default plugins found', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => []
          }
        })
        const data = { _enabledPlugins: ['existing'] }
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.deepEqual(data._enabledPlugins, ['existing'])
      })

      it('should not create _enabledPlugins when no default plugins found', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => []
          }
        })
        const data = {}
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.equal(data._enabledPlugins, undefined)
      })

      it('should call contentplugin.find with isAddedByDefault true', async () => {
        let findQuery
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async (query) => {
              findQuery = query
              return []
            }
          }
        })
        await preInsertHook.invoke({}, { schemaName: 'config' })
        assert.deepEqual(findQuery, { isAddedByDefault: true })
      })

      it('should handle a single default plugin', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'only-plugin' }]
          }
        })
        const data = {}
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.deepEqual(data._enabledPlugins, ['only-plugin'])
      })

      it('should handle many default plugins', async () => {
        const plugins = Array.from({ length: 10 }, (_, i) => ({ name: `plugin-${i}` }))
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => plugins
          }
        })
        const data = {}
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.equal(data._enabledPlugins.length, 10)
        plugins.forEach((p, i) => {
          assert.equal(data._enabledPlugins[i], p.name)
        })
      })

      it('should handle all plugins already enabled', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-a' }, { name: 'plugin-b' }]
          }
        })
        const data = { _enabledPlugins: ['plugin-a', 'plugin-b'] }
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.deepEqual(data._enabledPlugins, ['plugin-a', 'plugin-b'])
      })

      it('should preserve order of existing plugins', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-c' }]
          }
        })
        const data = { _enabledPlugins: ['plugin-b', 'plugin-a'] }
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.deepEqual(data._enabledPlugins, ['plugin-b', 'plugin-a', 'plugin-c'])
      })

      it('should handle _enabledPlugins as empty array', async () => {
        const { preInsertHook } = await createModule({
          contentplugin: {
            find: async () => [{ name: 'plugin-a' }]
          }
        })
        const data = { _enabledPlugins: [] }
        await preInsertHook.invoke(data, { schemaName: 'config' })
        assert.deepEqual(data._enabledPlugins, ['plugin-a'])
      })
    })
  })
})
