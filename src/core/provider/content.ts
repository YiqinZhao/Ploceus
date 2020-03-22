import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import hljs from 'highlight.js'
import markdownIt from 'markdown-it'

import { FSTreeNode } from './fs'
import { RenderDelegate } from '..'
import { FSDataProvider, DataProviderDelegate } from './fs'


// Data Structure
type ContentTreeChildren = { [key: string]: ContentTreeNode }
export class ContentTreeNode extends FSTreeNode {
    source?: FSTreeNode
    parent: FSTreeNode | null = null
    children: { [key: string]: FSTreeNode } = {}

    constructor() { super('', null) }

    get data(): any { return this.source!.data }

    getExt(): string { return path.extname(this.name) }

    castParent(): ContentTreeNode | null {
        return this.parent
            ? ContentTreeNode.fromFSTreeNode(this.parent)
            : null
    }

    castChildren(): ContentTreeChildren {
        return Object.keys(this.children)
            .map(v => ContentTreeNode.fromFSTreeNode(this.children[v]))
            .reduce((obj: ContentTreeChildren, v: ContentTreeNode) => {
                obj[v.name] = v
                return obj
            }, {})
    }

    static fromFSTreeNode(object: FSTreeNode): ContentTreeNode {
        const res = new ContentTreeNode()
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


// 3rd Tools
const md: any = markdownIt({
    html: true,
    highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return '<pre class="hljs"><code>' +
                    hljs.highlight(lang, str, true).value +
                    '</code></pre>'
            } catch (__) { }
        }

        return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
    }
}).use(require('@iktakahiro/markdown-it-katex'))
    .use(require('markdown-it-anchor'))


// Implementation
export class ContentProvider extends FSDataProvider implements DataProviderDelegate {
    renderDelegate?: RenderDelegate
    providerDelegate = this

    dispatch(event: string, node: FSTreeNode) {
        const contentNode = ContentTreeNode.fromFSTreeNode(node)
        this.castContent(contentNode)

        if (!contentNode.isDir) {
            if (contentNode.name === 'conf.yaml') {
                this.updateLayoutIndex(contentNode)
            } else if (
                contentNode.name === 'site.yaml'
                && contentNode.getFullPath() === 'site.yaml'
            ) {
                this.updateSiteConf(contentNode)

                if (!contentNode.data.rootURL) {
                    contentNode.data.rootURL = '/'
                }

                contentNode.data.rootURL = contentNode.data.rootURL
                    .slice(-1) === '/'
                    ? contentNode.data.rootURL.slice(0, -1)
                    : contentNode.data.rootURL
            }
        }

        if (event === 'add') this.onAddEvent(contentNode)
        else if (event === 'addDir') this.onAddDirEvent(contentNode)
        else if (event === 'change') this.onChangeEvent(contentNode)
    }

    shouldTriggerParentRender(node: ContentTreeNode): boolean {
        return ['.yaml', '.md'].includes(node.getExt())
    }

    onAddEvent(node: ContentTreeNode) {
        this.renderDelegate!.onContentRenderRequest(
            this.shouldTriggerParentRender(node)
                ? node.castParent()!
                : node
        )
    }

    onAddDirEvent(node: ContentTreeNode) {
        this.renderDelegate!.onContentRenderRequest(node)
    }

    onChangeEvent(node: ContentTreeNode) {
        this.renderDelegate!.onContentRenderRequest(
            this.shouldTriggerParentRender(node)
                ? node.castParent()!
                : node
        )
    }

    // Cast Data
    castContent(node: ContentTreeNode) {
        if (node.getExt() === '.md') {
            node.source!.data = this.onCastMarkdown(node)
        } else if (node.getExt() === '.yaml') {
            node.source!.data = this.onCastYAML(node)
        }
    }

    onCastMarkdown(node: ContentTreeNode): string {
        const globalData = this.renderDelegate!.dataPool.globalData
        let result = md.render(fs.readFileSync(node.physicalPath!).toString())

        // Custom command
        const commands = globalData.site.markdown?.commands
        if (commands) {
            let res = result
            Object.keys(commands).forEach(v => {
                const commandTemplate = commands[v]
                const commandCalls = result.match(new RegExp(`\!${v}\(.*?\)\!`, 'g'))
                if (commandCalls) {
                    commandCalls.forEach((e: string) => {
                        let commandState = e.match(/\(.*?\)/)![0]
                            .slice(1, -1)
                            .split(',')
                            .map(v => v.trim())
                            .reduce((s, v, i) => {
                                return s.replace(`#${i}`, v)
                            }, commandTemplate)
                        res = res.replace(e, commandState)
                    })
                }
            })
            result = res
        }

        // Replace command alias
        const aliases = globalData.site.markdown?.alias
        if (aliases) {
            Object.keys(aliases).forEach(v => {
                result = result.replace(`!${v}!`, aliases[v])
            })
        }

        // Replace image path with abs path
        let absURL = `${globalData.site.rootURL}/${path.dirname(node.getFullPath())}`
        result = result.replace(/img src="\//g, `img src="${absURL}/`)
        result = result.replace(/a href="\//g, `a href="${absURL}/`)

        result = result.replace(/img src="~\//g, `img src="${globalData.site.rootURL}/`)
        result = result.replace(/a href="~\//g, `a href="${globalData.site.rootURL}/`)

        return result
    }

    onCastYAML(node: ContentTreeNode): string {
        return yaml.parse(fs.readFileSync(node.physicalPath!).toString())
    }

    // Render
    updateLayoutIndex(node: ContentTreeNode) {
        const template = node.data.template
        const tNameTocNodeList = this.renderDelegate!.dataPool.tNameTocNodeList

        if (tNameTocNodeList[template]) {
            if (!tNameTocNodeList[template].includes(template)) {
                tNameTocNodeList[template].push(node.castParent()!)
            }
        } else {
            tNameTocNodeList[template] = [node.castParent()!]
        }
    }

    updateSiteConf(node: ContentTreeNode) {
        this.renderDelegate!.dataPool.globalData.site = node.data!
        this.recursiveRender(ContentTreeNode.fromFSTreeNode(this.dataTree.root))
    }

    recursiveRender(node: ContentTreeNode) {
        this.renderDelegate!.onContentRenderRequest(node)
        Object.keys(node.castChildren()).forEach(v => {
            this.recursiveRender(node.castChildren()[v])
        })
    }
}
