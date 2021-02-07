import path from "path"
import bs from "browser-sync"
import consola from "consola"
import chokidar from "chokidar"
import { RenderController } from "./render"
import { FSTree, FSTreeNode } from "./fsutils"

interface PloceusOptions {
    dev?: boolean,
    production: boolean
}

export class Ploceus {
    rootPath: string
    distPath: string
    options: PloceusOptions
    isBooting: boolean = true
    renderController: RenderController

    templateMap: { [key: string]: FSTreeNode } = {}
    templateRefs: { [key: string]: FSTreeNode[] } = {}

    private fsTree: FSTree
    private listeners: { [key: string]: Function } = {}

    constructor(rootPath: string, options: PloceusOptions) {
        this.options = options
        this.rootPath = path.resolve(rootPath)
        this.distPath = path.resolve(this.rootPath, "dist")

        this.fsTree = new FSTree(this)
        this.renderController = new RenderController(this)

        chokidar.watch(this.rootPath)
            .on("all", this.onScanEvent)
            .on("error", this.onScanError)
            .on("ready", this.onInitialScanFinished)
    }

    onInitialScanFinished() {
        // cast site.yaml and check other necessary components
        if (!this.fsTree.rootNode!.children["site.yaml"]) {
            this.listeners.error(new Error("site.yaml not found"))
            process.exit(1)
        }

        this.listeners.ready("ready")

        this.renderController.consume()
        this.isBooting = false
    }

    onScanError(error: Error) {
        consola.error(error.message)
    }

    onScanEvent(
        event: "add" | "addDir" | "change" | "unlink" | "unlinkDir",
        filePath: string
    ) {
        const dirname = path.dirname(filePath)
        const nodeName = path.basename(filePath)
        const parentNodes = this.fsTree.findNodesOnPath(dirname)
        const fartherNode = parentNodes?.slice(-1)[0]

        let node: FSTreeNode | undefined

        if (event === "addDir" || event === "add") {
            node = this.fsTree.addNodeAt(fartherNode, nodeName)
        } else if (event === "change") {
            node = fartherNode!.children[nodeName]
        } else if (event === "unlink" || event === "unlinkDir") {
            this.fsTree.removeNodeAt(fartherNode!, nodeName)
        }

        const nodes = (parentNodes ?? []).concat(node ?? [])
        this.renderController.feed(nodes)
    }

    on(event: "ready", listener: () => void): Ploceus;
    on(event: "close", listener: () => void): Ploceus;
    on(event: "error", listener: (error: Error) => void): Ploceus;

    on(event: "ready" | "close" | "error", listener: Function): Ploceus {
        this.listeners[event] = listener
        return this
    }
}
