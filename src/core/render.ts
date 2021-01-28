import fs from "fs"
import ejs from "ejs"
import path from "path"
import dayjs from "dayjs"
import { Ploceus } from "."
import { FSTreeNode, RecognizedFileType } from "./fstree"
import { fstat } from "fs"

export class RenderController {
    private timer?: NodeJS.Timeout
    private taskQueue: FSTreeNode[] = []
    private taskMap: { [key: string]: number } = {}
    private templateMap: { [key: string]: FSTreeNode[] } = {}

    private controller: Ploceus

    constructor(controller: Ploceus) {
        this.controller = controller
    }

    feed(node: FSTreeNode) {
        if (this.timer) clearTimeout(this.timer)

        this.taskQueue.push(node)
        this.taskMap[node.filePath] = this.taskQueue.length - 1
        this.timer = setTimeout(() => { this.renderAll() }, 100);
    }

    renderTemplate(templateName?: string) {
        if (!templateName) {
            Object
                .values(this.templateMap)
                .forEach(nodes => {
                    nodes.forEach(v => { this.render(v) })
                })
        } else {
            this.templateMap[templateName].forEach(v => {
                this.render(v)
            })
        }
    }

    deleteTemplateMapNode(filePath: string) {
        Object.keys(this.templateMap)
            .forEach(k => {
                this.templateMap[k] = this.templateMap[k]
                    .filter(v => {
                        v.filePath !== filePath
                    })
            })
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
            }, {
                meta: {
                    filePath: node.filePath,
                    basename: path.basename(node.filePath)
                }
            })
    }

    render(node: FSTreeNode) {
        let data = this.castRenderData(node)
        const templateName = data['conf.yaml']['template']

        // Register template - node relation
        if (!this.templateMap[templateName]) this.templateMap[templateName] = []
        let nodeInList = this.templateMap[templateName]
            .reduce((r, v) => r || v.filePath === node.filePath, false)
        if (!nodeInList) this.templateMap[templateName].push(node)

        const relPath = path
            .relative(this.controller.rootPath, node.filePath)
            .split(path.sep)
            .slice(1)
            .join(path.sep)

        // Render to file
        const outFilePath = path.resolve(
            this.controller.distPath,
            relPath,
            'index.html')

        const templateNode = this.controller.findTemplateNode(templateName)

        this.doEjsRendering(templateNode.filePath, data, (err: Error | undefined, html: string) => {
            fs.mkdirSync(path.dirname(outFilePath), { recursive: true })
            fs.writeFileSync(outFilePath, html)
        })

        // console.log(data)
        // console.log(outFilePath)

        // more render
    }

    doEjsRendering(templatePath: string, data: any, callback: Function) {
        ejs.renderFile(templatePath, {
            data
        }, {
            context: {
                global: this.controller.globalData,
                utils: {
                    dayjs
                }
            }
        }, (err, html) => {
            callback(err, html)
            // try {
            //     if (err) {
            //         logRed('error', 'render', templatePath)
            //         console.log(err.message)
            //     } else {
            //         logGreen('success', 'render', data.sourcePath)
            //     }

            //     // Move all style to the front style slot
            //     let output = html
            //     if (html.includes('<!-- StyleSlot -->')) {
            //         const styleBundle = html.match(/<style[^>]*>([^<]+)<\/style>/g)?.join('') || ''
            //         output = html.replace(/<style[^>]*>([^<]+)<\/style>/g, '')
            //         output = output.replace(/\<\!-- StyleSlot --\>/g, styleBundle)
            //     }

            //     callback(err, output)
            // } catch (err) {
            //     logRed('error', 'render', err.message)
            //     callback(err, html)
            // }
        })
    }

    renderAll() {
        this.taskQueue.forEach((v, i) => {
            if (this.taskMap[v.filePath] !== i) return

            let isRenderAnchor = Object
                .keys(v.children)
                .includes("conf.yaml")

            if (!isRenderAnchor) return

            this.render(v)

            process.exit()
        })
    }
}
