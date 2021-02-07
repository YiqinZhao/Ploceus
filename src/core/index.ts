import path from "path"
import consola from "consola"
import chokidar from "chokidar"
import { RenderController } from "./render"
import { FSTree, FSTreeNode } from "./fsutils"

export interface SiteConfig {
    ignore?: string[],
    [key: string]: any
}

interface PloceusOptions {
    dev?: boolean,
    production: boolean,
    siteConfig: SiteConfig
}

export class Ploceus {
    rootPath: string
    distPath: string
    options: PloceusOptions
    isBooting: boolean = true
    renderController: RenderController

    templateMap: { [key: string]: FSTreeNode } = {}
    templateRefs: { [key: string]: FSTreeNode[] } = {}

    fsTree: FSTree
    listeners: { [key: string]: Function } = {}

    constructor(rootPath: string, options: PloceusOptions) {
        this.options = options
        this.rootPath = path.resolve(rootPath)
        this.distPath = path.resolve(this.rootPath, "dist")

        this.fsTree = new FSTree(this)
        this.renderController = new RenderController(this)

        chokidar.watch([
            path.join(this.rootPath, "content"),
            path.join(this.rootPath, "theme"),
            path.join(this.rootPath, "site.yaml")
        ], {
            ignored: this.options.siteConfig.ignore
        }).on("all", this.onScanEvent.bind(this))
            .on("error", this.onScanError.bind(this))
            .on("ready", this.onInitialScanFinished.bind(this))
    }

    onInitialScanFinished() {
        this.renderController.consume()
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

        let impactedNodes = this.fsTree.findNodesOnPath(dirname)
        const fartherNode = impactedNodes?.reverse()[0]

        let node: FSTreeNode | undefined

        if (event === "addDir" || event === "add") {
            node = this.fsTree.addNodeAt(fartherNode, nodeName)

        } else if (event === "change") {
            node = fartherNode!.children[nodeName]

            // template node
            if (node.type === "template") {
                // re-render everything for template component
                impactedNodes = (
                    node.relPath.split(path.sep)[2] === "components"
                        ? Object.keys(this.templateRefs)
                            .reduce((arr: FSTreeNode[], k) => {
                                return arr.concat(this.templateRefs[k])
                            }, [])
                        : this.templateRefs[nodeName])

                node = undefined
            }

        } else if (event === "unlink" || event === "unlinkDir") {
            this.fsTree.removeNodeAt(fartherNode!, nodeName)
            return
        }

        if (node && node!.nodePath === path.join(this.rootPath, "site.yaml")) {
            node!.cast()
        }

        if (this.isBooting) {
            this.renderController.feed([node!])
        } else {
            this.renderController
                .feed((impactedNodes ?? []).concat(node ?? []))
            this.renderController.consume()
        }
    }

    on(event: "ready", listener: () => void): Ploceus;
    on(event: "close", listener: () => void): Ploceus;
    on(event: "error", listener: (error: Error) => void): Ploceus;

    on(event: "ready" | "close" | "error", listener: Function): Ploceus {
        this.listeners[event] = listener
        return this
    }
}
