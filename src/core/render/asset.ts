import fs from 'fs'
import path from 'path'

import { RenderDataPool } from '..'
import { DedicatedRenderer } from '.'
import { ThemeTreeNode } from '../provider/theme'
import { ContentTreeNode } from '../provider/content'
import { ensureDir } from "../utils/fs"

export class AssetRenderingRecipe {
    constructor(
        public id: string,
        public node: ContentTreeNode | ThemeTreeNode
    ) { }
}

export class AssetRenderer implements DedicatedRenderer {
    distPath: string = '.'
    dataPool?: RenderDataPool

    renderAsset(recipe: AssetRenderingRecipe): void {
        const node = recipe.node

        if (node.isDir) return

        const ext = path.extname(node.name)
        const targetExt = [
            '.jpg', '.jpeg', '.svg', '.png',
            '.pdf', '.css', '.bmp'
        ]

        if (targetExt.includes(ext) || node.getFullPath().includes('assets')) {
            const targetPath = path.resolve(path.join(this.distPath, node.getFullPath()))

            let copyFlag = !fs.existsSync(targetPath)
                || (fs.existsSync(targetPath)
                    && fs.statSync(targetPath).mtime < node.stat!.mtime)

            if (copyFlag) {
                ensureDir(path.dirname(targetPath))
                fs.copyFileSync(node.physicalPath!, targetPath)
            }
        }
    }
}
