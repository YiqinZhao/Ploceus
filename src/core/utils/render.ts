import cheerio from 'cheerio'

export function selectDOMItemWithLimit(content: string, selector: string, min: number, max: number) {
    const targets = cheerio.load(content)(selector)
    const parents = targets.parents().toArray()
    let topParent = parents[0]

    for (const p of parents) {
        if (p.tagName === 'body') break
        else topParent = p
    }

    let result = cheerio.html(topParent!)
    let originalItem = ''
    let filteredItems = ''

    for (let i = 0; i < targets.length; i++) {
        const childHTML = cheerio.html(targets.get(i))
        originalItem += childHTML + '\n'
        if (i >= min && i < max) { filteredItems += childHTML }
    }

    result = result.replace(originalItem, filteredItems)

    return result
}

export function selectDOMItem(content: string, selector: string) {
    return cheerio.html(cheerio.load(content)(selector))
}
