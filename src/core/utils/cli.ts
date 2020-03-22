import chalk from 'chalk'

export function logGreen(type: string, mark: string, message: string) {
    console.log(chalk.green(`[${type}:${mark}]`) + ' ' + message)
}

export function logGreenBg(message: string) {
    console.log(chalk.bgGreen(message))
}

export function logRed(type: string, mark: string, message: string) {
    console.log(chalk.red(`[${type}:${mark}]`) + ' ' + message)
}

export function logBlue(type: string, mark: string, message: string) {
    console.log(chalk.blue(`[${type}:${mark}]`) + ' ' + message)
}

export function logDebugInfo(message: string) {
    console.log(chalk.bgWhite(chalk.black(message)))
}
