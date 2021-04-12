import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import CryptoJS from "crypto-js"
import matter from "gray-matter"

import { Ploceus } from "."

import Prism from "prismjs"
import prism from "markdown-it-prism"
import markdownIt from "markdown-it"

const md: any = markdownIt({
    html: true,
}).use(prism, {
    init: (prism: typeof Prism) => {
        var latex_cmd = /\\(?:[`~@#$%^&()_=+{}\[\]\|\\:;"',\?\/]|[a-z]+\*?(?=\s*{?))/mi;
        var internal_tags = {
            'equation': {
                pattern: /(\$\$?)[^\$]+\1/mi,
                alias: 'function italic',
                inside: {
                    'tag': latex_cmd
                }
            },
            'tag': latex_cmd
        };

        prism.languages.bib = {
            'comment': /%.*/,
            'special': {
                pattern: /(^\s*)@(?:(?:preamble|string(?=\s*[({]))|comment(?=\s*[{]))/mi,
                lookbehind: true,
                alias: 'important'
            },
            'type': {
                pattern: /(^\s*)@[^,={}'"\s]+(?=\s*{)/mi,
                lookbehind: true,
                alias: 'function bold'
            },
            'name': {
                pattern: /([,{]\s*)[^,={}'"\s]+(?=\s*[,}])/mi,
                lookbehind: true,
                alias: 'regex'
            },
            'field': {
                pattern: /([,{(]\s*)[^,={}'"\s]+(?=\s*=)/mi,
                lookbehind: true,
                alias: 'keyword'
            },
            'number': {
                pattern: /(=\s*)[0-9]+(?=\s*[,}])/mi,
                lookbehind: true,
                alias: 'char'
            },
            'value': {
                pattern: /([=#]\s*){(?:[^{}]*|{(?:[^{}]*|{(?:[^{}]*|{[^}]*})*})*})*}/mi,
                lookbehind: true,
                alias: 'char',
                greedy: true,
                inside: internal_tags
            },
            'ref-string': {
                pattern: /([=#]\s*)[^,={}'"\s]+(?=\s*[#,}])/mi,
                lookbehind: true,
                alias: 'keyword'
            },
            'char': {
                pattern: /("|')(?:(?!\1)[^\\]|\\(?:\r\n|[\s\S]))*\1/mi,
                greedy: true,
                inside: internal_tags
            },
            'symbol': /#/,
            'punctuation': /[=,{}]/
        };
        prism.languages.bibtex = prism.languages.bib
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

    constructor(nodePath: string, rootNode?: FSTreeNode) {
        this.nodePath = nodePath
        this.dirName = path.dirname(nodePath)
        this.baseName = path.basename(nodePath)
        this.relPath = rootNode
            ? path.relative(rootNode.nodePath, nodePath)
            : '.'

        const ext = path.extname(this.baseName)

        if (fs.lstatSync(nodePath).isDirectory()) {
            this.type = "dir"
        } else if (ext === ".yaml" || ext === ".yml") {
            this.type = "yaml"
        } else if (ext === ".md" || ext === ".markdown") {
            this.type = "md"
        } else if (
            this.relPath.split(path.sep).includes("assets")
            || [".png", ".jpg", ".jpeg", ".bmp", ".svg", ".pdf"].includes(ext)) {
            this.type = "asset"
        } else if (ext === ".ejs") {
            this.type = "template"
        } else {
            this.type = "other"
        }
    }

    cast() {
        let data: any

        if (this.type === "md") {
            data = matter(fs.readFileSync(this.nodePath, 'utf-8'))
            data.content = (md.render(data.content) as string)
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

        this.data = data
    }
}

export class FSTree {
    rootNode: FSTreeNode
    private controller: Ploceus

    constructor(controller: Ploceus) {
        this.controller = controller
        this.rootNode = new FSTreeNode(controller.rootPath)
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
            if (i > rel.length) break
            node = node.children[rel[i++]]
        }

        return result
    }

    addNodeAt(fatherNode: FSTreeNode, nodeName: string): FSTreeNode {
        let node = fatherNode.children[nodeName] = new FSTreeNode(
            path.join(fatherNode.nodePath, nodeName),
            this.rootNode)

        if (node.type === "template") {
            this.controller.templateMap[nodeName] = node
            this.controller.templateRefs[nodeName] = []
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
