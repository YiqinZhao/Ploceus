import fs from 'fs'

export function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function rmdirNotEmpty(dir: string, rmSelf: boolean) {
    dir = dir + '/'

    if (!fs.existsSync(dir)) return
    const files = fs.readdirSync(dir)

    if (files.length > 0) {
        files.forEach(function (x, i) {
            if (fs.statSync(dir + x).isDirectory()) {
                module.exports.rmdirNotEmpty(dir + x)
            } else {
                fs.unlinkSync(dir + x)
            }
        })
    }
    if (rmSelf) {
        // check if user want to delete the directory ir just the files in this directory
        fs.rmdirSync(dir)
    }
}
