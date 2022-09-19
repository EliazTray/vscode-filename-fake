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

  const disposable = vscode.commands.registerCommand('filename-fake.fake', async () => {
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
  const { nanoid } = require('nanoid')
  `
}

export function deactivate() {
  console.log('deactivate for fake-filename')
}
