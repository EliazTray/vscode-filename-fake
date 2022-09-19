import path from 'path'
import fs from 'fs'
import N from 'nanoid'
import vscode from 'vscode'

interface IData {
  fileName: string
  text: string
}

type UUID = string

export async function activate(context: vscode.ExtensionContext) {
  const fileUri = vscode.Uri.joinPath(context.globalStorageUri, 'file.json')
  if (!fs.existsSync(fileUri.path)) {
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from('{}'))
    console.log('file.json created')
  }
  else {
    console.log('file.json exists')
  }

  const disposable = vscode.commands.registerCommand('vscode-filename-fake.fake', async () => {
    const openList = vscode.workspace.textDocuments

    const json = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8')
    let data: Record<UUID, IData> = {}
    try {
      data = JSON.parse(json)
    }
    catch (error) {
      if (error instanceof Error)
        vscode.window.showErrorMessage(error.message)
    }

    for (const file of openList) {
      const { name: UUID, dir, base } = path.posix.parse(file.fileName)
      // 如果已经记录 UUID fileName，就 recover
      if (data[UUID]) {
        const { fileName, text } = data[UUID]
        await vscode.workspace.fs.writeFile(file.uri, Buffer.from(text))
        await vscode.workspace.fs.rename(file.uri, vscode.Uri.file(fileName))
        delete data[UUID]
      }
      // 如果没有记录，就 fake  fileName, 并写入
      // TODO: support other suffix
      else if (/\d+\.[\s\S]+\.(js|ts)/g.test(base)) {
        const text = file.getText()
        const UUID = N.nanoid()
        const newFilePath = `${dir}/${UUID}.js`
        // do store global content with unique id, and origin baseName for later recover
        data[UUID] = {
          fileName: file.fileName,
          text,
        }
        await vscode.workspace.fs.writeFile(file.uri, Buffer.from(template()))
        vscode.workspace.fs.rename(file.uri, vscode.Uri.file(newFilePath))
      }
    }
    // 写入 data
    vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(data)))
  })

  context.subscriptions.push(disposable)
}

function template() {
  return `
  import Hash from './Hash.js'
  
  /**
   * Gets the data for `map`.
   *
   * @private
   * @param {Object} map The map to query.
   * @param {string} key The reference key.
   * @returns {*} Returns the map data.
   */
  function getMapData({ __data__ }, key) {
    const data = __data__
    return isKeyable(key)
      ? data[typeof key === 'string' ? 'string' : 'hash']
      : data.map
  }
  
  /**
   * Checks if `value` is suitable for use as unique object key.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
   */
  function isKeyable(value) {
    const type = typeof value
    return (type === 'string' || type === 'number' || type === 'symbol' || type === 'boolean')
      ? (value !== '__proto__')
      : (value === null)
  }
  
  class MapCache {
  
    /**
     * Creates a map cache object to store key-value pairs.
     *
     * @private
     * @constructor
     * @param {Array} [entries] The key-value pairs to cache.
     */
    constructor(entries) {
      let index = -1
      const length = entries == null ? 0 : entries.length
  
      this.clear()
      while (++index < length) {
        const entry = entries[index]
        this.set(entry[0], entry[1])
      }
    }
  
    /**
     * Removes all key-value entries from the map.
     *
     * @memberOf MapCache
     */
    clear() {
      this.size = 0
      this.__data__ = {
        'hash': new Hash,
        'map': new Map,
        'string': new Hash
      }
    }
  
    /**
     * Removes `key` and its value from the map.
     *
     * @memberOf MapCache
     * @param {string} key The key of the value to remove.
     * @returns {boolean} Returns `true` if the entry was removed, else `false`.
     */
    delete(key) {
      const result = getMapData(this, key)['delete'](key)
      this.size -= result ? 1 : 0
      return result
    }
  
    /**
     * Gets the map value for `key`.
     *
     * @memberOf MapCache
     * @param {string} key The key of the value to get.
     * @returns {*} Returns the entry value.
     */
    get(key) {
      return getMapData(this, key).get(key)
    }
  
    /**
     * Checks if a map value for `key` exists.
     *
     * @memberOf MapCache
     * @param {string} key The key of the entry to check.
     * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
     */
    has(key) {
      return getMapData(this, key).has(key)
    }
  
    /**
     * Sets the map `key` to `value`.
     *
     * @memberOf MapCache
     * @param {string} key The key of the value to set.
     * @param {*} value The value to set.
     * @returns {Object} Returns the map cache instance.
     */
    set(key, value) {
      const data = getMapData(this, key)
      const size = data.size
  
      data.set(key, value)
      this.size += data.size == size ? 0 : 1
      return this
    }
  }
  
  export default MapCache
  `
}

export function deactivate() {
  console.log('deactivate for fake-filename')
}
