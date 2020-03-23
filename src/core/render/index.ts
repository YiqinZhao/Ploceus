import { Mixin } from 'ts-mixer'

import { RenderDataPool } from ".."
import { PageRenderingRecipe, PageRenderer } from './page'
import { AssetRenderingRecipe, AssetRenderer } from './asset'
import { logRed, logDebugInfo } from "../utils/cli"

export interface RenderingRecipe {
    id: string
}

export interface DedicatedRenderer {
    distPath: string
    dataPool?: RenderDataPool
}

interface DebouncePool {
    [key: string]: NodeJS.Timeout
}

export class Renderer extends Mixin(AssetRenderer, PageRenderer) {
    distPath: string = '.'
    dataPool?: RenderDataPool
    debouncePool: DebouncePool = {}

    render(recipe: RenderingRecipe) {
        if (this.debouncePool[recipe.id]) {
            clearTimeout(this.debouncePool[recipe.id])
        }

        let renderFn = undefined

        if (recipe instanceof AssetRenderingRecipe)
            renderFn = this.renderAsset
        else if (recipe instanceof PageRenderingRecipe)
            renderFn = this.renderPage

        if (!renderFn) {
            logRed('error', 'renderer', ` not implemented.`)
            return
        }

        this.debouncePool[recipe.id] = (
            function (recipe: RenderingRecipe, render: Function) {
                return setTimeout(() => {
                    render(recipe)
                }, 100)
            }
        )(recipe, renderFn.bind(this))
    }
}
