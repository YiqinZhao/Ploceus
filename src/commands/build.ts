import fs from "fs"
import path from 'path'
import yaml from "js-yaml"
import consola from "consola"

import { Ploceus, SiteConfig } from '../core'
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
        const siteConfPath = path.join(sourcePath, "site.yaml")

        if (!fs.existsSync(siteConfPath)) {
            consola.error("site.yaml not found")
            process.exit(1)
        }

        let siteConfig = yaml.load(
            fs.readFileSync(siteConfPath).toString()
        ) as SiteConfig

        fs.rmSync(
            path.resolve(sourcePath, "dist"),
            { recursive: true, force: true })

        if (flags.production) {
            consola.start("Building site with production optimization.")
        }

        new Ploceus(sourcePath, {
            production: flags.production, siteConfig
        }).on("ready", () => {
            consola.success("generation successfully finished")
            process.exit(0)
        })
    }
}
