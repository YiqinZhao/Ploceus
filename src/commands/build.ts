import fs from "fs"
import path from 'path'
import consola from "consola"

import { Ploceus } from '../core'
import { Command, flags } from '@oclif/command'

export default class Build extends Command {
    static description = 'Build a site.'

    static examples = [
        `$ ploceus build`,
    ]

    static flags = {
        help: flags.help({ char: 'h', }),
        production: flags.boolean({ char: 'p', description: 'enable production optimization during build.' })
    }

    static args = [
        { name: 'path', description: 'source files path', default: '.' },
    ]

    async run() {
        const { args, flags } = this.parse(Build)

        const sourcePath = path.resolve(args.path)
        fs.rmSync(path.resolve(sourcePath, "dist"), { recursive: true, force: true })

        if (flags.production) this.log('Building site with production optimization.')
        new Ploceus(sourcePath, {
            production: flags.production
        }).on("ready", () => {
            consola.success("generation successfully finished")
        })
    }
}
