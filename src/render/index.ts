import ejs from 'ejs'
import path from 'path'
import dayjs from 'dayjs'

import { RenderDataPool } from ".."
import { logRed, logGreen } from "../utils/cli"
import { selectDOMItem, selectDOMItemWithLimit } from '../utils/render'

interface StringFunctionMap {
    [key: string]: Function
}

interface DebouncePool {
    [key: string]: NodeJS.Timeout
}

export class Renderer {
    dataPool?: RenderDataPool
    debouncePool: DebouncePool = {}

    renderEJS(templatePath: string, data: any, callback: Function) {
        ejs.renderFile(templatePath, {
            data
        }, {
            context: {
                globalData: this.dataPool!.globalData,
                utils: {
                    dayjs,
                    selectDOMItem,
                    selectDOMItemWithLimit
                }
            }
        }, (err, html) => {
            if (err) {
                logRed('error', 'render', templatePath)
                console.log(err.message)
            } else {
                logGreen('success', 'render', data.sourcePath)
            }

            callback(err, html)
        })
    }

    render(templatePath: string, data: any, callback: Function) {
        const templateExt = path.extname(templatePath)
        const renderMap: StringFunctionMap = {
            '.ejs': this.renderEJS.bind(this)
        }

        if (this.debouncePool[data.sourcePath]) {
            clearTimeout(this.debouncePool[data.sourcePath])
        }

        this.debouncePool[data.sourcePath] = (
            function (templatePath, data, cb, render) {
                return setTimeout(() => {
                    render(templatePath, data, cb)
                }, 100)
            }
        )(templatePath, data, callback, renderMap[templateExt]!)
    }
}
