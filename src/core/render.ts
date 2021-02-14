import fs from "fs"
import ejs from "ejs"
import path from "path"
import dayjs from "dayjs"
import { Ploceus } from "."
import consola from "consola"
import { minify } from "html-minifier"
import { FSTreeNode } from "./fsutils"

export class RenderController {
    private taskQueue: FSTreeNode[] = []
    private controller: Ploceus

    constructor(controller: Ploceus) {
        this.controller = controller
    }

    feed(nodes: FSTreeNode[]) {
        this.taskQueue = this.taskQueue.concat(nodes)
    }

    consume() {
        this.taskQueue.reverse().forEach(v => {
            this.render(v)
        })
        this.taskQueue = []

        if (this.controller.isBooting) {
            this.controller.listeners.ready("ready")
            this.controller.isBooting = false
        }
    }

    castDataSeries(node: FSTreeNode): any {
        if (Array.isArray(node.data)) return node.data
        else return {
            meta: {
                path: node.relPath,
                baseName: node.baseName
            },
            ...node.data,
            ...Object.keys(node.children)
                .reduce((obj: any, v) => {
                    obj[v] = this.castDataSeries(node.children[v])
                    return obj
                }, {})
        }
    }

    render(node: FSTreeNode) {
        const distPath = path.join(
            this.controller.distPath,
            node.relPath
                .split(path.sep)
                .slice(1)
                .join(path.sep))

        if (node.type === "asset") {
            fs.mkdirSync(path.dirname(distPath), { recursive: true })
            fs.copyFileSync(node.nodePath, distPath)
            consola.success("[Asset]", distPath)
            return
        }

        if (node.type === "md" || node.type === "yaml") {
            node.cast()
            return
        }

        if (!node.children["conf.yaml"]) return

        const data = this.castDataSeries(node)
        const templateNode = this.controller
            .templateMap[data["conf.yaml"].template]

        if (!templateNode) return

        if (!(this.controller.templateRefs[templateNode.baseName]
            .map(v => v.nodePath).includes(node.nodePath))) {
            this.controller.templateRefs[templateNode.baseName].push(node)
        }

        // Invoke renderer specific function
        this.doEjsRendering(
            templateNode.nodePath, data,
            (err: Error | undefined, html: string) => {
                if (err) {
                    consola.error(node.nodePath)
                    console.error(err);
                    return
                }

                fs.mkdirSync(distPath, { recursive: true })

                const distFilePath = path.join(distPath, "index.html")
                fs.writeFileSync(
                    distFilePath,
                    this.controller.options.production
                        ? minify(html, { minifyCSS: true, minifyJS: true, collapseWhitespace: true })
                        : html
                )

                consola.success("[Page]", distFilePath)
            })
    }

    doEjsRendering(templatePath: string, data: any, callback: Function) {
        try {
            ejs.renderFile(templatePath, {
                config: {
                    site: this.controller.options.siteConfig
                },
                data
            }, {
                context: {
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
}
