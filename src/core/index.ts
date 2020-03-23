import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import rimraf from 'rimraf'

import { Renderer } from './render'
import { PageRenderingRecipe } from './render/page'
import { AssetRenderingRecipe } from './render/asset'
import { ThemeTreeNode, ThemeProvider } from './provider/theme'
import { ContentTreeNode, ContentProvider } from './provider/content'

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

export class Ploceus implements RenderDelegate {
    renderFn: Function
    dataPool: RenderDataPool
    themeProvider: ThemeProvider
    contentProvider: ContentProvider

    ready: boolean = false
    production?: boolean

    constructor(config: PloceusConfig) {
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

        this.production = production

        rimraf.sync(distPath)

        const renderer = new Renderer()
        renderer.distPath = distPath
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

        if (node.isDir) {
            this.renderFn(new PageRenderingRecipe(
                node.getFullPath(), node
            ))
        }
        else {
            this.renderFn(new AssetRenderingRecipe(
                node.getFullPath(), node
            ))
        }
    }

    onTemplateRenderRequest(node: ThemeTreeNode): void {
        if (!this.ready) return

        if (!node.isTemplate()) {
            this.renderFn(new AssetRenderingRecipe(
                node.getFullPath(), node
            ))
        } else if (this.dataPool.tNameTocNodeList[node.getTemplateName()!]) {
            this.dataPool
                .tNameTocNodeList[node.getTemplateName()!]
                .forEach(v => {
                    this.renderFn(new PageRenderingRecipe(
                        node.getFullPath(), v
                    ))
                })
        }
    }
}
