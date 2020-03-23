import fs from 'fs'
import ejs from 'ejs'
import path from 'path'
import dayjs from 'dayjs'
import minify from 'html-minifier'

import { RenderDataPool } from '..'
import { ThemeTreeNode } from '../provider/theme'
import { ContentTreeNode } from '../provider/content'
import { ensureDir } from "../utils/fs"
import { logRed, logGreen } from "../utils/cli"
import { selectDOMItem, selectDOMItemWithLimit } from '../utils/render'
import { DedicatedRenderer, RenderingRecipe } from "."

export class PageRenderingRecipe implements RenderingRecipe {
    constructor(
        public id: string,
        public contentNode: ContentTreeNode,
        public templateNode?: ThemeTreeNode,
        public production: boolean = false
    ) { }
}

export class PageRenderer implements DedicatedRenderer {
    distPath: string = '.'
    dataPool?: RenderDataPool

    // Render Data Prepare
    extractDirNodeData(node: ContentTreeNode): any {
        const children = node.castChildren()
        return {
            name: node.name,
            stat: node.stat,
            data: node.data,
            ...Object.keys(children)
                .map(v => children[v])
                .filter(v => !v.isDir)
                .reduce((obj: any, v) => {
                    obj[v.name] = v.data
                    return obj
                }, {}),
            children: Object.keys(children)
                .map(v => children[v])
                .filter(v => v.isDir)
                .map(v => this.extractDirNodeData(v))
        }
    }

    extractBindData(node: ContentTreeNode, data: any) {
        const conf = data['conf.yaml']
        data.bind = {}
        Object.keys(conf.bind).forEach((v: string) => {
            data.bind[v] = {
                data: this.extractDirNodeData(
                    v.split('/').reduce(
                        (node: ContentTreeNode, v: string): ContentTreeNode => {
                            if (v === '..') return node.castParent()!
                            else return node.castChildren()[v]
                        },
                        node
                    )
                ),
                ...conf.bind[v]
            }
        })
    }

    doEJSTemplateRendering(templatePath: string, data: any, callback: Function) {
        ejs.renderFile(templatePath, {
            data
        }, {
            context: {
                globalData: this.dataPool!.globalData,
                utils: {
                    dayjs,
                    selectDOMItem,
                    selectDOMItemWithLimit
                }
            }
        }, (err, html) => {
            if (err) {
                logRed('error', 'render', templatePath)
                console.log(err.message)
            } else {
                logGreen('success', 'render', data.sourcePath)
            }

            callback(err, html)
        })
    }

    dispatchRenderingByTemplate(templatePath: string, data: any, callback: Function) {
        const templateExt = path.extname(templatePath)
        const templateRenderMap: { [key: string]: Function } = {
            '.ejs': this.doEJSTemplateRendering.bind(this)
        }

        if (templateRenderMap[templateExt]) {
            templateRenderMap[templateExt](templatePath, data, callback)
        } else {
            logRed('error', 'renderer', `${templateExt} template rendering not implemented.`)
        }
    }

    optimize(html: string) {
        return minify.minify(html, { minifyCSS: true, minifyJS: true })
    }

    renderPage(recipe: PageRenderingRecipe): void {
        const node = recipe.contentNode
        const production = recipe.production

        if (!node.getChildren()['conf.yaml']) return

        const data = this.extractDirNodeData(node)
        data.sourcePath = node.getFullPath()

        const layout = data['conf.yaml'].template
        const templateNode = this.dataPool!.tNameTotNode[layout]

        if (!templateNode) {
            logRed('error', 'render', `no such layout ${layout}`)
            return
        }

        const conf = data['conf.yaml']
        if (!conf) return
        if (conf.bind) this.extractBindData(node, data)

        this.dispatchRenderingByTemplate(
            templateNode.physicalPath!, data,
            (err: Error, html: string) => {
                if (err) return

                const conf = data['conf.yaml']
                const outputPath = path.join(
                    this.distPath,
                    node.getFullPath(),
                    conf.trimPrefix ? '..' : '',
                    'index.html'
                )
                const output = production
                    ? this.optimize(html)
                    : html

                ensureDir(path.dirname(outputPath))
                fs.writeFileSync(outputPath, output)
            }
        )
    }
}
