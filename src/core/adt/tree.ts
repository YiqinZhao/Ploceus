import path from 'path'

interface TreeNodeInterface<T> {
    name: string
    getFullPath(): string
    addChild(node: T): void
}

export class TreeNode<P extends TreeNodeInterface<P>, C extends TreeNodeInterface<C>> {
    children: { [key: string]: C } = {}

    constructor(
        public name: string,
        public parent: P | null
    ) { }

    getParent(): P | null {
        return this.parent
    }

    setParent(value: P | null) {
        this.parent = value
    }

    getChildren(): { [key: string]: C } {
        return this.children
    }

    setChildren(value: { [key: string]: C }) {
        this.children = value
    }

    getFullPath(): string {
        return path.join(
            (this.parent ? this.parent.getFullPath() : ''),
            this.name
        )
    }

    addChild(node: C): void {
        this.children[node.name] = node
    }
}

export class Tree<T extends TreeNode<T, T>> {
    root?: T

    addNodeByPath(path: string, node: T): boolean {
        const p = path.split('/')
        const result = p
            .reduce((n: T | null, v: string, i: number): T | null => {
                if (!n) return null

                if (i === p.length - 1) {
                    n!.children[v] = node
                    node.parent = n
                }

                return n.children[v]
            }, this.root!)

        return !!result
    }

    getNodeByPath(treePath: string): T | null {
        return treePath
            .split('/')
            .filter(v => !!v)
            .reduce((n: T | null, v: string): T | null => {
                return n?.children[v] || null
            }, this.root!)
    }
}
