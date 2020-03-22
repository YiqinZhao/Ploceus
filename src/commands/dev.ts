import fs from 'fs'
import path from 'path'

import bs from 'browser-sync'
import { Ploceus } from '../core'
import { Command, flags } from '@oclif/command'

export default class Build extends Command {
    static description = 'Watch file changes and rebuild. Also start a dev server.'

    static examples = [
        `$ ploceus dev`,
    ]

    static flags = {
        help: flags.help({ char: 'h', })
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
            distPath
        })

        ploceus.watch()

        const bsInstance = bs.init({
            server: './dist',
            logLevel: 'silent',
            files: '**/*',
            ghostMode: false
        })

        const port = bsInstance.getOption('port')
        this.log('Development server started at', port)
    }
}
