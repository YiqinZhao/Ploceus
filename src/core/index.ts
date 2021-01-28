import util from "util"
import path from "path"
import chokidar from "chokidar"
import { RenderController } from "./render"
import { FSTree, FSTreeNode } from "./fstree"

export class Ploceus {
    rootPath: string
    distPath: string
    globalData: any = {}
    renderController: RenderController

    private fsTree: FSTree

    constructor(rootPath: string) {
        this.rootPath = path.resolve(rootPath)
        this.distPath = path.resolve(this.rootPath, "dist")

        this.fsTree = new FSTree(this)
        this.renderController = new RenderController(this)

        chokidar.watch(this.rootPath).on("all", (event, filePath) => {
            if (filePath == this.rootPath) return

            const basedir = path
                .relative(this.rootPath, filePath)
                .split(path.sep)[0]

            const isContent = basedir === "content"
            const isTemplate = basedir === "template"

            let node: FSTreeNode | undefined

            if (event === "addDir" || event == "add") {
                node = this.fsTree.addNodeByPath(filePath)
                if (node && isContent) this.fsTree.castNodeData(node)

                if (node) {
                    this.fsTree.castNodeData(node)
                    const nodeBaseName = path.basename(filePath)
                    if (["theme.yaml", "site.yaml"].includes(nodeBaseName)) {
                        this.globalData[nodeBaseName] = node.data
                    }
                }
            }

            if (event === "change") {
                node = this.fsTree.findNodeByPath(filePath)
                if (node && isContent) this.fsTree.castNodeData(node)

                if (node) {
                    const nodeBaseName = path.basename(filePath)
                    if (["theme.yaml", "site.yaml"].includes(nodeBaseName)) {
                        this.globalData[nodeBaseName] = node.data
                    }
                }
            }

            if (event === "unlink" || event == "unlinkDir") {
                node = this.fsTree.removeNodeByPath(filePath)
                this.renderController.deleteTemplateMapNode(filePath)
            }

            // render content node
            while (node && isContent) {
                this.renderController.feed(node)
                node = node.parent
            }

            // render template node
            if (isTemplate) {
                if (path.dirname(filePath) === "template") {
                    this.renderController.renderTemplate(path.basename(filePath))
                } else if (path.dirname(filePath) === "components") {
                    this.renderController.renderTemplate()
                }
            }
        })
    }

    findTemplateNode(templateName: string): FSTreeNode {
        let templateNode = this.fsTree
            .findNodeByPath(
                path.resolve(this.rootPath, "theme", "template", templateName))

        if (!templateNode) throw new Error("No template found")

        return templateNode
    }
}
