import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import hljs from 'highlight.js'
import markdownIt from 'markdown-it'

import { FSTreeNode } from '../adt/fs-tree'
import { RenderDelegate } from '..'
import { FSDataProvider, DataProviderDelegate } from './fs'
import { logDebugInfo } from "../utils/cli"


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


export class ContentProvider extends FSDataProvider implements DataProviderDelegate {
    renderDelegate?: RenderDelegate
    providerDelegate = this

    dispatch(event: string, node: FSTreeNode) {
        this.castContent(node)

        if (!node.isDir) {
            if (node.name === 'conf.yaml') {
                this.updateLayoutIndex(node)
            } else if (node.name === 'site.yaml' && node.getFullPath() === 'site.yaml') {
                this.updateSiteConf(node)
                if (!node.data.rootURL) node.data.rootURL = '/'
                node.data.rootURL = node.data.rootURL.slice(-1) === '/'
                    ? node.data.rootURL.slice(0, -1)
                    : node.data.rootURL
            }
        }

        if (event === 'add') this.onAddEvent(node)
        else if (event === 'addDir') this.onAddDirEvent(node)
        else if (event === 'change') this.onChangeEvent(node)
    }

    shouldTriggerParentRender(node: FSTreeNode): boolean {
        return ['.yaml', '.md'].includes(path.extname(node.name))
    }

    onAddEvent(node: FSTreeNode) {
        this.renderDelegate!.onContentRenderRequest(
            this.shouldTriggerParentRender(node)
                ? node.parent!
                : node
        )
    }

    onAddDirEvent(node: FSTreeNode) {
        this.renderDelegate!.onContentRenderRequest(node)
    }

    onChangeEvent(node: FSTreeNode) {
        this.renderDelegate!.onContentRenderRequest(
            this.shouldTriggerParentRender(node)
                ? node.parent!
                : node
        )
    }

    // Cast Data
    castContent(node: FSTreeNode) {
        const ext = path.extname(node.name)

        if (ext === '.md') {
            node.data = this.onCastMarkdown(node)
        } else if (ext === '.yaml') {
            node.data = this.onCastYAML(node)
        }
    }

    onCastMarkdown(node: FSTreeNode): string {
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

    onCastYAML(node: FSTreeNode): string {
        return yaml.parse(fs.readFileSync(node.physicalPath!).toString())
    }

    // Render
    updateLayoutIndex(node: FSTreeNode) {
        const layout = node.data.layout
        const tNameTocNodeList = this.renderDelegate!.dataPool.tNameTocNodeList

        if (tNameTocNodeList[layout]) {
            if (!tNameTocNodeList[layout].includes(layout)) {
                tNameTocNodeList[layout].push(node.parent!)
            }
        } else {
            tNameTocNodeList[layout] = [node.parent!]
        }
    }

    updateSiteConf(node: FSTreeNode) {
        this.renderDelegate!.dataPool.globalData.site = node.data!
        this.recursiveRender(this.dataTree.root)
    }

    recursiveRender(node: FSTreeNode) {
        this.renderDelegate!.onContentRenderRequest(node)
        Object.keys(node.children).forEach(v => {
            this.recursiveRender(node.children[v])
        })
    }
}
