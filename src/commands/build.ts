import fs from 'fs'
import path from 'path'

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
        { name: 'content', description: 'content folder', default: './content' },
        { name: 'theme', description: 'theme folder', default: './theme' },
        { name: 'dist', description: 'dist folder', default: './dist' }
    ]

    async run() {
        const { args, flags } = this.parse(Build)

        const contentPath = path.resolve(args.content)
        const themePath = path.resolve(args.theme)
        const distPath = path.resolve(args.dist)

        if (!fs.existsSync(path.join(contentPath, 'site.yaml'))) {
            this.error('content folder not exists!')
        }

        if (!fs.existsSync(path.join(themePath, 'conf.yaml'))) {
            this.error('theme folder not exists!')
        }

        const ploceus = new Ploceus({
            contentPath,
            themePath,
            distPath,
            production: flags.production
        })

        if (flags.production) this.log('Building site with production optimization.')

        ploceus.build()
    }
}
