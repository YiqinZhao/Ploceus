import fs from "fs"
import ejs from "ejs"
import path from "path"
import dayjs from "dayjs"
import { Ploceus } from "."
import consola from "consola"
import { minify } from "html-minifier"
import { FSTreeNode, RecognizedFileType } from "./fstree"

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
            this.templateMap[templateName]?.forEach(v => {
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
                    basename: node.baseName,
                    filePath: node.filePath,
                    relPath: node
                        .relPath.split(path.sep).slice(1).join("/")
                }
            })
    }

    render(node: FSTreeNode) {
        const relPath = path
            .relative(this.controller.rootPath, node.filePath)
            .split(path.sep)
            .slice(1)
            .join(path.sep)

        const outFolder = path
            .resolve(this.controller.distPath, relPath)

        // copy assets
        Object.values(node.children).forEach(child => {
            if (child.data?.copy) {
                const outFile = path.resolve(outFolder, child.baseName)
                fs.mkdirSync(outFolder, { recursive: true })
                fs.copyFileSync(child.filePath, outFile)
                consola.success(outFile)
            }
        })

        // render html page
        let isRenderAnchor = Object
            .keys(node.children)
            .includes("conf.yaml")

        if (!isRenderAnchor) return


        let data = this.castRenderData(node)
        const templateName = data['conf.yaml']?.template

        if (!templateName) return

        // Register template - node relation
        if (!this.templateMap[templateName]) this.templateMap[templateName] = []
        let nodeInList = this.templateMap[templateName]
            .reduce((r, v) => r || v.filePath === node.filePath, false)
        if (!nodeInList) this.templateMap[templateName].push(node)


        // Render to file
        const prefix = data["conf.yaml"].trimPrefix ? ".." : "."
        const outFilePath = path.resolve(outFolder, prefix, "index.html")
        const templateNode = this.controller.findTemplateNode(templateName)

        // Invoke renderer specific function
        this.doEjsRendering(templateNode.filePath, data, (err: Error | undefined, html: string) => {
            if (err) {
                consola.error(data.meta.filePath)
                console.error(err);
                return
            }

            fs.mkdirSync(path.dirname(outFilePath), { recursive: true })


            fs.writeFileSync(
                outFilePath,
                this.controller.options.production
                    ? minify(html, { minifyCSS: true, minifyJS: true, collapseWhitespace: true })
                    : html
            )

            consola.success(outFilePath)
        })
    }

    doEjsRendering(templatePath: string, data: any, callback: Function) {
        try {
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
                let output = html
                if (html && html.includes('<!-- StyleSlot -->')) {
                    const styleBundle = html.match(/<style[^>]*>([^<]+)<\/style>/g)?.join('') || ''
                    output = html.replace(/<style[^>]*>([^<]+)<\/style>/g, '')
                    output = output.replace(/\<\!-- StyleSlot --\>/g, styleBundle)
                }

                callback(err, output)
            })
        } catch (error) {
            callback(error, undefined)
        }
    }

    renderAll() {
        this.taskQueue.forEach((v, i) => {
            // console.log(v.filePath, this.taskMap[v.filePath], i)
            if (this.taskMap[v.filePath] !== i) return
            this.render(v)
        })
        this.taskQueue = []
        this.taskMap = {}

        if (!this.controller.options.dev) {
            process.exit()
        }
    }
}
