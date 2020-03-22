import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import rimraf from 'rimraf'
import minify from 'html-minifier'

import { ThemeTreeNode, ThemeProvider } from './provider/theme'
import { ContentTreeNode, ContentProvider } from './provider/content'
import { Renderer } from './render'
import { logRed } from "./utils/cli"
import { ensureDir } from './utils/fs'

export interface RenderDelegate {
    dataPool: RenderDataPool

    onContentRenderRequest(node: ContentTreeNode): void
    onTemplateRenderRequest(node: ThemeTreeNode): void

    build(): void
    watch(): void
}

export interface RenderDataPool {
    globalData: any,
    tNameTocNodeList: { [key: string]: ContentTreeNode[] },
    tNameTotNode: { [key: string]: ThemeTreeNode }
}

interface PloceusConfig {
    contentPath: string,
    themePath: string,
    distPath: string,
    production?: boolean
}

class ContentDataExtractor {
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
}

export class Ploceus extends ContentDataExtractor implements RenderDelegate {
    distPath: string
    renderFn: Function
    dataPool: RenderDataPool
    themeProvider: ThemeProvider
    contentProvider: ContentProvider

    ready: boolean = false
    production?: boolean

    constructor(config: PloceusConfig) {
        super()

        const { contentPath, themePath, distPath, production } = config

        this.dataPool = {
            globalData: {
                themeConf: yaml.parse(
                    fs.readFileSync(
                        path.join(themePath, 'conf.yaml')
                    ).toString()
                )
            },
            tNameTocNodeList: {},
            tNameTotNode: {}
        }

        this.distPath = distPath
        this.production = production

        rimraf.sync(distPath)

        const renderer = new Renderer()
        renderer.dataPool = this.dataPool
        this.renderFn = renderer.render.bind(renderer)

        const ignoreList = ['.DS_Store']

        this.themeProvider = new ThemeProvider(
            themePath, ignoreList
        )
        this.themeProvider.renderDelegate = this

        this.contentProvider = new ContentProvider(
            contentPath, ignoreList
        )

        this.contentProvider.renderDelegate = this
        this.build()
        this.ready = true
    }

    build() {
        this.themeProvider.build()
        this.contentProvider.build()
    }

    watch() {
        this.themeProvider.watch()
        this.contentProvider.watch()
    }

    onContentRenderRequest(node: ContentTreeNode): void {
        if (!this.ready) return

        if (node.isDir) this.renderPage(node)
        else this.renderAsset(node)
    }

    onTemplateRenderRequest(node: ThemeTreeNode): void {
        if (!this.ready) return

        if (!node.isTemplate()) {
            this.renderAsset(node)
        } else if (this.dataPool.tNameTocNodeList[node.getTemplateName()!]) {
            this.dataPool
                .tNameTocNodeList[node.getTemplateName()!]
                .forEach(v => {
                    this.renderPage(v)
                })
        }
    }

    renderAsset(node: ContentTreeNode | ThemeTreeNode): void {
        if (node.isDir) return

        const ext = path.extname(node.name)
        const targetExt = [
            '.jpg', '.jpeg', '.svg', '.png',
            '.pdf', '.css', '.bmp'
        ]

        if (targetExt.includes(ext) || node.getFullPath().includes('assets')) {
            const targetPath = path.resolve(path.join(this.distPath, node.getFullPath()))

            let copyFlag = !fs.existsSync(targetPath)
                || (fs.existsSync(targetPath)
                    && fs.statSync(targetPath).mtime < node.stat!.mtime)

            if (copyFlag) {
                ensureDir(path.dirname(targetPath))
                fs.copyFileSync(node.physicalPath!, targetPath)
            }
        }
    }

    renderPage(node: ContentTreeNode): void {
        if (!node.getChildren()['conf.yaml']) return

        const data = this.extractDirNodeData(node)
        data.sourcePath = node.getFullPath()

        const layout = data['conf.yaml'].template
        const templateNode = this.dataPool.tNameTotNode[layout]

        if (!templateNode) {
            logRed('error', 'render', `no such layout ${layout}`)
            return
        }

        const conf = data['conf.yaml']
        if (!conf) return
        if (conf.bind) this.extractBindData(node, data)

        this.renderFn(templateNode.physicalPath!, data,
            (err: Error, html: string) => {
                if (err) return

                const conf = data['conf.yaml']
                const outputPath = path.join(
                    this.distPath,
                    node.getFullPath(),
                    conf.trimPrefix ? '..' : '',
                    'index.html'
                )
                const output = this.production
                    ? minify.minify(html, { minifyCSS: true, minifyJS: true })
                    : html

                ensureDir(path.dirname(outputPath))
                fs.writeFileSync(outputPath, output)
            }
        )
    }
}
