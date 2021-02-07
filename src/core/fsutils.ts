import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import CryptoJS from "crypto-js"
import matter from "gray-matter"

import { Ploceus } from "."
import hljs from "highlight.js"
import markdownIt from "markdown-it"

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
    .use(require('markdown-it-emoji'))


type CastingType = "dir" | "yaml" | "md" | "asset" | "template" | "other"

interface RenderingData {
    meta: {
        absPath: string
    },
    [key: string]: any
}

export class FSTreeNode {
    type: CastingType
    dirName: string
    relPath: string
    baseName: string
    nodePath: string
    parent?: FSTreeNode
    data?: RenderingData
    children: { [key: string]: FSTreeNode } = {}

    constructor(nodePath: string, rootNode: FSTreeNode) {
        this.nodePath = nodePath
        this.dirName = path.dirname(nodePath)
        this.baseName = path.basename(nodePath)
        this.relPath = path.relative(rootNode.dirName, nodePath)

        const ext = path.extname(this.baseName)

        if (fs.lstatSync(nodePath).isDirectory()) {
            this.type = "dir"
        } else if (ext === "yaml" || ext === "yml") {
            this.type = "yaml"
        } else if (ext === "md" || ext === "markdown") {
            this.type = "md"
        } else if (
            this.relPath.split(path.sep).includes("assets")
            || ["png", "jpg", "jpeg", "bmp", "svg", "pdf"].includes(ext)) {
            this.type = "asset"
        } else if (ext === "ejs") {
            this.type = "template"
        } else {
            this.type = "other"
        }
    }

    cast() {
        const meta = {
            meta: {
                absPath: this.relPath
            }
        }

        let data: any

        if (this.type === "md") {
            let content = matter(fs.readFileSync(this.nodePath, 'utf-8'))
            data = (md.render(content) as string)
                .replace(/-s-(.*?)-s-/gms, v => {
                    const secret = data.data.password
                    // Single line
                    if (v.split('\n').length === 1) {
                        const encrypted = CryptoJS.AES
                            .encrypt(v.split('-s-').filter(v => v.length).join('-'), secret)
                            .toString()

                        return `<span class="encrypted">${encrypted}</span>`
                    } else {
                        const encrypted = CryptoJS.AES
                            .encrypt(v.split('\n').slice(1, -1).join('-'), secret)
                            .toString()

                        return `<div class="encrypted">${encrypted}</div>`
                    }
                })
        } else if (this.type === "yaml") {
            data = yaml.load(fs.readFileSync(this.nodePath, 'utf-8'))
        }

        this.data = { ...meta, ...data }
    }
}

export class FSTree {
    rootNode?: FSTreeNode
    private controller: Ploceus

    constructor(controller: Ploceus) {
        this.controller = controller
    }

    findNodesOnPath(nodePath: string): FSTreeNode[] {
        const rel = path
            .relative(this.controller.rootPath, nodePath)
            .split(path.sep)

        let i = 0
        let node = this.rootNode
        let result: FSTreeNode[] = []

        while (node) {
            result.push(node)
            if (i >= rel.length) break
            node = node.children[rel[i++]]
        }

        return result
    }

    addNodeAt(fatherNode: FSTreeNode, nodeName: string): FSTreeNode {
        const node = fatherNode.children[nodeName] = new FSTreeNode(
            path.join(fatherNode.dirName, nodeName),
            this.rootNode!)

        if (node.type === "template") {
            this.controller.templateMap[nodeName] = node
        }

        return node
    }

    removeNodeAt(fatherNode: FSTreeNode, nodeName: string) {
        if (fatherNode.children[nodeName].type === "template") {
            delete this.controller.templateMap[nodeName]
        } else {
            Object.keys(this.controller.templateRefs)
                .forEach(k => {
                    this.controller.templateRefs[k] =
                        this.controller.templateRefs[k]
                            .filter(v => v.baseName !== nodeName)
                })
        }

        delete fatherNode.children[nodeName]
    }
}
