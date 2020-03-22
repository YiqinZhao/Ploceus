import fs from 'fs'
import path from 'path'
import { FSTreeNode } from '../adt/fs-tree'
import { RenderDelegate } from '..'
import { FSDataProvider, DataProviderDelegate } from './fs'


export class ThemeProvider extends FSDataProvider implements DataProviderDelegate {
    providerDelegate = this
    renderDelegate?: RenderDelegate

    dispatch(event: string, node: FSTreeNode) {
        this.castContent(node)

        if (event === 'add') this.onAddEvent(node)
        else if (event === 'addDir') this.onAddDirEvent(node)
        else if (event === 'change') this.onChangeEvent(node)
    }

    castContent(node: FSTreeNode) {
        const ext = path.extname(node.getFullPath())

        if (ext === '.ejs') {
            node.data = fs.readFileSync(node.physicalPath!).toString()
        }
    }

    onAddEvent(node: FSTreeNode) {
        this.renderDelegate!.onContentRenderRequest(node)

        const ext = path.extname(node.getFullPath())

        if (ext === '.ejs') {
            const name = node.name.replace(ext, '')
            this.renderDelegate!.dataPool.tNameTotNode[name] = node
        }
    }

    onAddDirEvent(node: FSTreeNode) { }

    onChangeEvent(node: FSTreeNode) {
        this.renderDelegate!.onContentRenderRequest(node)
        const name = node.name.replace(path.extname(node.name), '')

        // When change happens on a component
        const templatePath = node.getFullPath()
        if (templatePath.includes('components')) {
            const parentFolder = node.parent!.parent!.parent!

            const walkDir = (dirNode: FSTreeNode | null): FSTreeNode[] => {
                return Object.keys(dirNode?.children || {})
                    .map(v => dirNode!.children[v])
                    .reduce((arr: FSTreeNode[], v: FSTreeNode): FSTreeNode[] => {
                        if (v.name.includes('.ejs')) return arr.concat([v])
                        else if (v.isDir) return arr.concat(walkDir(v))
                        else return arr
                    }, [])
            }

            walkDir(parentFolder)
                .filter(v => {
                    return v.data?.includes(
                        `include('../components/${name}/${name}.ejs'`
                    ) || v.data?.includes(
                        `include('../${name}/${name}.ejs'`
                    )
                })
                .forEach(v => { this.onChangeEvent(v) })

            return
        }

        // When happens on a template node
        if (this.renderDelegate!.dataPool.tNameTocNodeList[name]) {
            this.renderDelegate!.dataPool.tNameTocNodeList[name]
                .forEach(v => {
                    this.renderDelegate!.onContentRenderRequest(v as FSTreeNode)
                })
        }
    }
}
