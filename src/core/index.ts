import fs from "fs"
import util from "util"
import path from "path"
import yaml from "js-yaml"
import chokidar from "chokidar"
import hljs from "highlight.js"
import matter from "gray-matter"
import markdownIt from "markdown-it"
import { clearTimeout } from "timers"

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

enum RecognizedFileType {
    dir,
    yaml,
    md,
    other
}

interface FSTreeNode {
    data?: any
    filePath: string
    fileType: RecognizedFileType

    parent?: FSTreeNode
    children: { [key: string]: FSTreeNode }
}

class FSTree {
    rootNode: FSTreeNode
    private rootPath: string

    constructor(rootPath: string) {
        this.rootNode = {
            filePath: rootPath, fileType: RecognizedFileType.dir,
            children: {}
        }
        this.rootPath = rootPath
    }

    findNodeByPath(nodePath: string): FSTreeNode | undefined {
        if (this.rootPath === nodePath) return this.rootNode
        const rel = path.relative(this.rootPath, nodePath).split(path.sep)

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
    }
}

class RenderController {
    taskQueue: FSTreeNode[] = []
    taskMap: { [key: string]: number } = {}
    private timer?: NodeJS.Timeout

    feed(node: FSTreeNode) {
        if (this.timer) clearTimeout(this.timer)

        this.taskQueue.push(node)
        this.taskMap[node.filePath] = this.taskQueue.length - 1
        this.timer = setTimeout(() => { this.render() }, 100);
    }

    castRenderData(node: FSTreeNode) {
        return Object.keys(node.children)
            .reduce((obj: any, v: string) => {
                if (node.children[v].fileType === RecognizedFileType.dir) {
                    obj[v] = this.castRenderData(node.children[v])
                } else {
                    if (node.children[v].data) obj[v] = node.children[v].data
                }
                return obj
            }, {})
    }

    render() {
        this.taskQueue.forEach((v, i) => {
            if (this.taskMap[v.filePath] !== i) return

            let isRenderAnchor = Object
                .keys(v.children)
                .includes("conf.yaml")

            if (!isRenderAnchor) return

            // console.log(util.inspect(v, { depth: null }))
            let data = this.castRenderData(v)

            console.log(data)
            process.exit()
        })
    }
}

export class FileTreeBuilder {
    rootPath: string
    renderController: RenderController

    private fsTree: FSTree

    constructor(rootPath: string) {
        this.rootPath = path.resolve(rootPath)
        this.fsTree = new FSTree(this.rootPath)
        this.renderController = new RenderController()

        chokidar.watch(this.rootPath).on("all", (event, filePath) => {
            if (filePath == this.rootPath) return

            let node: FSTreeNode | undefined

            if (event === "addDir" || event == "add") {
                node = this.fsTree.addNodeByPath(filePath)
                if (node) this.fsTree.castNodeData(node)
            }

            if (event === "change") {
                node = this.fsTree.findNodeByPath(filePath)
                if (node) this.fsTree.castNodeData(node)
            }

            if (event === "unlink" || event == "unlinkDir") {
                node = this.fsTree.removeNodeByPath(filePath)
            }

            while (node) {
                this.renderController.feed(node)
                node = node.parent
            }
        })
    }
}
