import fs from "fs"
import path from 'path'
import consola from "consola"

import bs from 'browser-sync'
import { Ploceus } from '../core'
import { Command, flags } from '@oclif/command'

export default class Dev extends Command {
    static description = 'Start development mode.'

    static examples = [
        `$ ploceus dev`,
    ]

    static flags = {
        ["fast-boot"]: flags.boolean({ char: 'f', default: false }),
        help: flags.help({ char: 'h' })
    }

    static args = [
        { name: 'path', description: 'source files path', default: '.' }
    ]

    async run() {
        const { args, flags } = this.parse(Dev)

        const sourcePath = path.resolve(args.path)
        const distPath = path.resolve(sourcePath, "dist")
        fs.rmSync(distPath, { recursive: true, force: true })
        fs.mkdirSync(distPath, { recursive: true })

        const bsInstance = bs.init({
            server: distPath,
            logLevel: 'silent',
            files: `${distPath}/**/*`,
            ghostMode: false,
            open: false
        })

        new Ploceus(sourcePath, {
            dev: true, production: false,
            bsInstance, fastBoot: flags["fast-boot"]
        })
    }
}
