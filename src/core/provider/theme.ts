import fs from 'fs'
import path from 'path'

import { FSTreeNode, FSTree } from './fs'
import { RenderDelegate } from '..'
import { FSDataProvider, DataProviderDelegate } from './fs'


// Data Structure
enum SupportedTemplateType {
    ejs = '.ejs'
}

type ThemeTreeChild = { [key: string]: ThemeTreeNode }

export class ThemeTreeNode extends FSTreeNode {
    source?: FSTreeNode
    parent: FSTreeNode | null = null
    children: { [key: string]: FSTreeNode } = {}

    constructor() { super('', null) }

    get data(): any { return this.source!.data }

    isTemplate(): boolean {
        return !!this.getTemplateType()
    }

    getTemplateType(): SupportedTemplateType | null {
        const ext = path.extname(this.name)
        if (ext === '.ejs') return SupportedTemplateType.ejs
        else return null
    }

    castParent(): ThemeTreeNode | null {
        return this.parent
            ? ThemeTreeNode.fromFSTreeNode(this.parent)
            : null
    }

    castChildren(): ThemeTreeChild {
        return Object.keys(this.children)
            .map(v => ThemeTreeNode.fromFSTreeNode(this.children[v]))
            .reduce((obj: ThemeTreeChild, v: ThemeTreeNode) => {
                obj[v.name] = v
                return obj
            }, {})
    }

    static fromFSTreeNode(object: FSTreeNode): ThemeTreeNode {
        const res = new ThemeTreeNode()
        res.source = object
        res.name = object.name
        res.isDir = object.isDir
        res.stat = object.stat
        res.physicalPath = object.physicalPath
        res.parent = object.parent
        res.children = object.children
        return res
    }
}


// Implementation
export class ThemeProvider extends FSDataProvider implements DataProviderDelegate {
    providerDelegate = this
    renderDelegate?: RenderDelegate

    dispatch(event: string, node: FSTreeNode) {
        const templateNode = ThemeTreeNode.fromFSTreeNode(node)

        this.castContent(templateNode)

        if (event === 'add') this.onAddEvent(templateNode)
        else if (event === 'addDir') this.onAddDirEvent(templateNode)
        else if (event === 'change') this.onChangeEvent(templateNode)
    }

    castContent(node: ThemeTreeNode) {
        if (!node.isTemplate()) return
        if (node.getTemplateType() === SupportedTemplateType.ejs) {
            node.source!.data = fs.readFileSync(node.physicalPath!).toString()
        } else {
            throw new Error('Not implemented!')
        }
    }

    onAddEvent(node: ThemeTreeNode) {
        if (node.isTemplate()) {
            this.renderDelegate!.dataPool.tNameTotNode[node.name] = node
            this.renderDelegate!.onTemplateRenderRequest(node)
        }
    }

    onAddDirEvent(node: ThemeTreeNode) { }

    onChangeEvent(node: ThemeTreeNode) {
        this.renderDelegate!.onTemplateRenderRequest(node)
        const name = node.name.replace(path.extname(node.name), '')

        // When change happens on a component
        const templatePath = node.getFullPath()
        if (templatePath.includes('components')) {
            const parentFolder = node.parent!.parent!

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
                .forEach(v => { this.onChangeEvent(ThemeTreeNode.fromFSTreeNode(v)) })

            return
        }

        // When happens on a template node
        if (this.renderDelegate!.dataPool.tNameTocNodeList[name]) {
            this.renderDelegate!.dataPool.tNameTocNodeList[name]
                .forEach(v => {
                    this.renderDelegate!.onContentRenderRequest(v)
                })
        }
    }
}
