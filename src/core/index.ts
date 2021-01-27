import fs from "fs"
import util from "util"
import path from "path"
import chokidar from "chokidar"

enum RecognizedFileType {
    dir,
    yaml,
    md,
    other
}

interface FSTreeNode {
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

    addNode(nodePath: string) {
        const rel = path.relative(this.rootPath, nodePath).split(path.sep)
        if (rel.length === 0) return

        const ext: string = path.extname(nodePath)
        let nodeType: RecognizedFileType

        if (fs.lstatSync(nodePath).isDirectory()) {
            nodeType = RecognizedFileType.dir
        } else if (Object.keys(RecognizedFileType).includes(ext)) {
            nodeType = RecognizedFileType[ext as keyof typeof RecognizedFileType]
        } else {
            nodeType = RecognizedFileType.other
        }

        let parentNode = this.rootNode
        let node: FSTreeNode = {
            filePath: nodePath, fileType: nodeType,
            children: {}
        }

        for (var i = 0; i < rel.length - 1; i++) {
            parentNode = parentNode.children![rel[i]]
        }

        parentNode.children[rel[rel.length - 1]] = node
        node.parent = parentNode

        // console.log(util.inspect(this.rootNode, { depth: null }))
    }

    castNodeData(node: FSTreeNode) { }
}

export class FileTreeBuilder {
    rootPath: string

    private fsTree: FSTree

    constructor(rootPath: string) {
        this.rootPath = path.resolve(rootPath)
        this.fsTree = new FSTree(this.rootPath)

        chokidar.watch(this.rootPath).on("all", (event, filePath) => {
            if (filePath == this.rootPath) return

            if (event === "addDir" || event == "add") {
                this.fsTree.addNode(filePath)
            }
        })
    }
}
