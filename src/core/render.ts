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
        this.taskQueue.forEach((v, i) => {
            // console.log(v.filePath, this.taskMap[v.filePath], i)
            this.render(v)
        })
        this.taskQueue = []
    }

    castDataSeries(node: FSTreeNode): any {
        return {
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
            return
        }

        if (node.type === "md" || node.type === "yaml") {
            node.cast()
            return
        }

        const data = this.castDataSeries(node)
        const templateNode = this.controller.templateMap[
            node.data!["conf.yaml"].template
        ]


        // Invoke renderer specific function
        this.doEjsRendering(
            templateNode.nodePath, data,
            (err: Error | undefined, html: string) => {
                if (err) {
                    consola.error(data.meta.filePath)
                    console.error(err);
                    return
                }

                fs.mkdirSync(path.dirname(distPath), { recursive: true })


                fs.writeFileSync(
                    distPath,
                    this.controller.options.production
                        ? minify(html, { minifyCSS: true, minifyJS: true, collapseWhitespace: true })
                        : html
                )

                consola.success(distPath)
            })
    }

    doEjsRendering(templatePath: string, data: any, callback: Function) {
        try {
            ejs.renderFile(templatePath, {
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
