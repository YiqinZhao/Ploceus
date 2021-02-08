import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import consola from "consola"

import bs from "browser-sync"
import { Ploceus, SiteConfig } from "../core"
import { Command, flags } from "@oclif/command"

export default class Dev extends Command {
    bsInstance?: bs.BrowserSyncInstance

    static description = 'Start development mode.'

    static examples = [
        `$ ploceus dev`,
    ]

    static flags = {
        help: flags.help({ char: 'h' })
    }

    static args = [
        { name: 'path', description: 'source files path', default: '.' }
    ]

    async run() {
        const { args } = this.parse(Dev)

        const sourcePath = path.resolve(args.path)
        const distPath = path.resolve(sourcePath, "dist")

        this.startPloceus(sourcePath)

        this.bsInstance = bs.init({
            server: distPath,
            logLevel: 'silent',
            files: `${distPath}/**/*`,
            ghostMode: false,
            open: false
        })
    }

    startPloceus(sourcePath: string) {
        const distPath = path.resolve(sourcePath, "dist")
        const siteConfPath = path.join(sourcePath, "site.yaml")

        if (!fs.existsSync(siteConfPath)) {
            consola.error("site.yaml not found")
            process.exit(1)
        }

        let siteConfig = yaml.load(
            fs.readFileSync(siteConfPath).toString()
        ) as SiteConfig

        fs.rmSync(distPath, { recursive: true, force: true })
        fs.mkdirSync(distPath, { recursive: true })

        new Ploceus(sourcePath, {
            dev: true, production: false, siteConfig
        }).on("ready", () => {
            consola.ready(`development server started at http://localhost:${this.bsInstance!.getOption("port")}`)
        }).on("error", error => {
            consola.error(error.message)
        }).on("restart", () => {
            consola.info("restarting ploceus instance")
            this.startPloceus(sourcePath)
        })
    }
}
