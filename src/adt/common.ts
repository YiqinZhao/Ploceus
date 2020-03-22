import path from 'path'
import { logDebugInfo } from "../utils/cli"

export interface StringMap {
    [key: string]: string
}

export interface StringNodeMap {
    [key: string]: TreeNode
}

export interface StringNodeListMap {
    [key: string]: TreeNode[]
}

interface TreeChild {
    [key: string]: TreeNode
}

export class TreeNode {
    name: string
    parent?: TreeNode
    children: TreeChild
    payload: any

    constructor(name: string, parent?: TreeNode) {
        this.name = name
        this.parent = parent
        this.children = {}
        this.payload = {}
    }

    getFullPath(): string {
        return path.join(
            (this.parent ? this.parent.getFullPath() : ''),
            this.name
        )
    }

    addChild(node: TreeNode): void {
        this.children[node.name] = node
    }
}

export class Tree {
    root?: TreeNode

    constructor(init: boolean = true) {
        if (init) {
            this.root = new TreeNode('')
        }
    }

    addNodeByPath(path: string, node: TreeNode): boolean {
        const p = path.split('/')
        const result = p
            .reduce((n: TreeNode | null, v: string, i: number): TreeNode | null => {
                if (!n) return null

                if (i === p.length - 1) {
                    n!.children[v] = node
                    node.parent = n
                }

                return n.children[v]
            }, this.root!)

        return !!result
    }

    getNodeByPath(treePath: string): TreeNode | null {
        return treePath
            .split('/')
            .filter(v => !!v)
            .reduce((n: TreeNode | null, v: string) => {
                return n?.children[v] || null
            }, this.root!)
    }
}
