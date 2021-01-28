import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import matter from "gray-matter"

import hljs from "highlight.js"
import markdownIt from "markdown-it"
import { Ploceus } from "."

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


export enum RecognizedFileType {
    dir,
    yaml,
    md,
    other
}

export interface FSTreeNode {
    data?: any
    filePath: string
    fileType: RecognizedFileType

    parent?: FSTreeNode
    children: { [key: string]: FSTreeNode }
}

export class FSTree {
    rootNode: FSTreeNode
    private controller: Ploceus

    constructor(controller: Ploceus) {
        this.controller = controller
        this.rootNode = {
            filePath: this.controller.rootPath, fileType: RecognizedFileType.dir,
            children: {}
        }
    }

    findNodeByPath(nodePath: string): FSTreeNode | undefined {
        if (this.controller.rootPath === nodePath) return this.rootNode
        const rel = path.relative(this.controller.rootPath, nodePath).split(path.sep)

        let node = this.rootNode
        for (var i = 0; i < rel.length; i++) {
            node = node.children![rel[i]]

            if (!node) return
        }

        return node
    }

    addNodeByPath(nodePath: string): FSTreeNode | undefined {
        const ext: string = path.extname(nodePath).slice(1)
        let nodeType: RecognizedFileType

        if (fs.lstatSync(nodePath).isDirectory()) {
            nodeType = RecognizedFileType.dir
        } else if (Object.keys(RecognizedFileType).includes(ext)) {
            nodeType = RecognizedFileType[ext as keyof typeof RecognizedFileType]
        } else {
            nodeType = RecognizedFileType.other
        }

        let node: FSTreeNode = {
            filePath: nodePath, fileType: nodeType,
            children: {}
        }

        let parentNode = this.findNodeByPath(path.dirname(nodePath))
        if (!parentNode) return

        parentNode!.children[path.basename(nodePath)] = node
        node.parent = parentNode

        // console.log(util.inspect(this.rootNode, { depth: null }))

        return node
    }

    removeNodeByPath(nodePath: string): FSTreeNode | undefined {
        let parentNode = this.findNodeByPath(path.dirname(nodePath))
        let nodeFileName = path.basename(nodePath)

        if (!parentNode) return
        delete parentNode!.children[nodeFileName]

        return parentNode
    }

    castNodeData(node: FSTreeNode) {
        if (node.fileType === RecognizedFileType.yaml) {
            node.data = yaml.load(fs.readFileSync(node.filePath, 'utf-8'))
        } else if (node.fileType === RecognizedFileType.md) {
            let data = matter(fs.readFileSync(node.filePath, 'utf-8'))
            data.content = md.render(data.content)
            node.data = data
        }

        const nodeBaseName = path.basename(node.filePath)
        if (nodeBaseName === "site.yaml") {
            this.controller.globalData[nodeBaseName] = node.data
        }
    }
}
