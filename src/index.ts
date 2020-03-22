import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import rimraf from 'rimraf'
import minify from 'html-minifier'

import { ensureDir } from './utils/fs'
import { StringNodeListMap, StringNodeMap } from './adt/common'
import { ThemeProvider } from './provider/theme'
import { ContentProvider } from './provider/content'
import { Renderer } from './render/renderer'
import { FSTreeNode } from './adt/fs-tree'
import { logRed } from "./utils/cli"

export interface RenderDelegate {
    dataPool: RenderDataPool

    onContentRenderRequest(contentNode: FSTreeNode): void
    onTemplateRenderRequest(templateNode: FSTreeNode): void

    build(): void
    watch(): void
}

export interface RenderDataPool {
    globalData: any,
    tNameTocNodeList: StringNodeListMap,
    tNameTotNode: StringNodeMap
}

export class Ploceus implements RenderDelegate {
    distPath: string
    renderFn: Function
    dataPool: RenderDataPool
    themeProvider: ThemeProvider
    contentProvider: ContentProvider

    ready: boolean = false

    constructor(themeName: string, distPath: string) {
        this.dataPool = {
            globalData: {
                themeConf: yaml.parse(
                    fs.readFileSync(`theme/${themeName}/conf.yaml`).toString()
                )
            },
            tNameTocNodeList: {},
            tNameTotNode: {}
        }

        this.distPath = distPath
        rimraf.sync(distPath)

        const renderer = new Renderer()
        renderer.dataPool = this.dataPool
        this.renderFn = renderer.render.bind(renderer)

        const ignoreList = ['.DS_Store']

        this.themeProvider = new ThemeProvider(
            `theme/${themeName}`, ignoreList
        )
        this.themeProvider.renderDelegate = this

        this.contentProvider = new ContentProvider(
            'content', ignoreList
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

    onContentRenderRequest(node: FSTreeNode): void {
        if (!this.ready) return

        if (node.isDir) this.renderPage(node)
        else this.renderAsset(node)
    }

    onTemplateRenderRequest(node: FSTreeNode): void {
        if (!this.ready) return

        if (path.extname(node.getFullPath()) !== '.ejs') {
            this.renderAsset(node)
            return
        }

        this.dataPool
            .tNameTocNodeList[node.name]
            .forEach(v => { this.renderPage(v as FSTreeNode) })
    }

    // Render Data Prepare
    extractDirNodeData(node: FSTreeNode): any {
        return {
            name: node.name,
            stat: node.stat,
            data: node.data,
            ...Object.keys(node.children)
                .map(v => node.children[v])
                .filter(v => !v.isDir)
                .reduce((obj: any, v) => {
                    obj[v.name] = v.data
                    return obj
                }, {}),
            children: Object.keys(node.children)
                .map(v => node.children[v])
                .filter(v => v.isDir)
                .map(v => this.extractDirNodeData(v))
        }
    }

    extractBindData(node: FSTreeNode, data: any) {
        const conf = data['conf.yaml']
        data.bind = {}
        Object.keys(conf.bind).forEach((v: string) => {
            data.bind[v] = {
                data: this.extractDirNodeData(
                    v.split('/').reduce(
                        (node: FSTreeNode, v: string): FSTreeNode => {
                            if (v === '..') return node.parent!
                            else return node.children[v]
                        },
                        node
                    )
                ),
                ...conf.bind[v]
            }
        })
    }

    renderAsset(node: FSTreeNode): void {
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

    renderPage(contentNode: FSTreeNode): void {
        if (!contentNode.children['conf.yaml']) return

        const data = this.extractDirNodeData(contentNode)
        data.sourcePath = contentNode.getFullPath()

        const layout = data['conf.yaml'].layout
        const templateNode = this.dataPool.tNameTotNode[layout] as FSTreeNode


        if (!templateNode) {
            logRed('error', 'render', `no such layout ${layout}`)
            return
        }

        const conf = data['conf.yaml']
        if (!conf) return
        if (conf.bind) this.extractBindData(contentNode, data)

        this.renderFn(templateNode.physicalPath!, data,
            (err: Error, html: string) => {
                if (err) {
                    console.log(data)
                    return
                }

                const conf = data['conf.yaml']
                const outputPath = path.join(
                    this.distPath,
                    contentNode.getFullPath(),
                    conf.trimPrefix ? '..' : '',
                    'index.html'
                )
                const output = process.env.NODE_ENV === 'production'
                    ? minify.minify(html, { minifyCSS: true, minifyJS: true })
                    : html

                ensureDir(path.dirname(outputPath))
                fs.writeFileSync(outputPath, output)
            }
        )
    }
}
