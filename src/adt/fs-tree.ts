import fs from 'fs'
import { Tree, TreeNode } from './common'

interface FSTreeChild {
    [key: string]: FSTreeNode
}

export class FSTreeNode extends TreeNode {
    stat?: fs.Stats
    isDir: boolean = false
    physicalPath?: string
    data?: any
    parent?: FSTreeNode
    children: FSTreeChild

    constructor(name: string, parent?: TreeNode) {
        super(name, parent)
        this.children = {}
    }
}

export class FSTree extends Tree {
    root: FSTreeNode

    constructor() {
        super(false)
        this.root = new FSTreeNode('')
    }

    addNodeByPath(path: string, node: FSTreeNode): boolean {
        return super.addNodeByPath(path, node)
    }

    getNodeByPath(path: string): FSTreeNode | null {
        return super.getNodeByPath(path) as FSTreeNode
    }
}
