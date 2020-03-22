import fs from 'fs'
import glob from 'glob'
import path from 'path'
import chokidar from 'chokidar'
import { Tree, TreeNode } from '../adt/tree'

// Data Structure
export class FSTreeNode extends TreeNode<FSTreeNode, FSTreeNode> {
    data?: any
    stat?: fs.Stats
    isDir: boolean = false
    physicalPath?: string
    children: { [key: string]: FSTreeNode } = {}
}

export class FSTree extends Tree<FSTreeNode> {
    root: FSTreeNode = new FSTreeNode('', null)
}

// Delegate
export interface DataProviderDelegate {
    dispatch(event: string, node: FSTreeNode): void
    castContent(node: FSTreeNode): void
}

// Implementation
export class FSDataProvider {
    dataTree: FSTree = new FSTree()
    sourcePath: string
    ignoreList: string[]

    providerDelegate?: DataProviderDelegate

    constructor(sourcePath: string, ignoreList: string[]) {
        this.sourcePath = path.resolve(sourcePath)
        this.ignoreList = ignoreList
    }

    watch() {
        chokidar.watch(this.sourcePath).on('all', (event, filePath) => {
            const treePath = filePath.replace(`${this.sourcePath}/`, '')
            const eventPatched = this.dataTree.getNodeByPath(treePath)
                ? 'change' : event
            this.process(eventPatched, filePath)
        })
    }

    build() {
        glob.sync(`${this.sourcePath}/**/*`)
            .filter(v => !this.ignoreList.includes(v))
            .sort((a, b) => a.length - b.length)
            .forEach(v => {
                const treePath = path.resolve(v)
                    .replace(this.sourcePath + '/', '')

                let event = this.dataTree.getNodeByPath(treePath)
                    ? 'change'
                    : (fs.statSync(v).isDirectory()
                        ? 'addDir'
                        : 'add')

                this.process(event, v)
            })
    }

    process(event: string, filePath: string) {
        const basename = path.basename(filePath)
        const filePhysicalPath = path.resolve(filePath)
        if (this.ignoreList.includes(basename)) return

        if (!['add', 'addDir', 'change'].includes(event)) return

        const eventMap: { [key: string]: Function } = {
            'add': this.onFSAdd,
            'addDir': this.onFSAddDir,
            'change': this.onFSChange
        }

        const impactedNode = eventMap[event].bind(this)(filePhysicalPath)
        this.providerDelegate?.dispatch(event, impactedNode)
    }

    onFSAdd(filePhysicalPath: string) {
        const fileName = path.basename(filePhysicalPath)
        const treePath = filePhysicalPath.replace(this.sourcePath + '/', '')

        const fileNode = new FSTreeNode(fileName, null)
        fileNode.isDir = false
        fileNode.stat = fs.statSync(filePhysicalPath)
        fileNode.physicalPath = filePhysicalPath

        this.dataTree.addNodeByPath(treePath, fileNode)

        return fileNode
    }

    onFSAddDir(filePhysicalPath: string) {
        const dirName = path.basename(filePhysicalPath)
        const treePath = filePhysicalPath.replace(this.sourcePath + '/', '')

        const fileNode = new FSTreeNode(dirName, null)
        fileNode.isDir = true
        fileNode.stat = fs.statSync(filePhysicalPath)
        fileNode.physicalPath = filePhysicalPath

        this.dataTree.addNodeByPath(treePath, fileNode)

        return fileNode
    }

    onFSChange(filePhysicalPath: string) {
        const treePath = filePhysicalPath.replace(this.sourcePath + '/', '')
        const fileNode = this.dataTree.getNodeByPath(treePath)!

        fileNode.stat = fs.statSync(filePhysicalPath)
        return fileNode
    }
}
