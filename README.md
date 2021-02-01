# Ploceus

> Ploceus (weaver birds) are named for their elaborately woven nests. --- [Wikipedia](https://en.wikipedia.org/wiki/Ploceidae)

**Ploceus** is a static site generator that helps you focus on both content writing 📖 and UI styling 💄 in an **easy & rapid** way. **Ploceus** generates site from structured content and theme files which can be built from scratch or from existing documents.

## Usage

**Installation**

```bash
npm install -g ploceus
# Or with yarn
yarn global add ploceus
```

Two folders, `content` and `theme`, need to be created in order to start building your website. Check [here](https://github.com/YiqinZhao/ploceus-example) for a simple example.

Use following command to start creating your site with build-in development server!

```
cd <PROJECT_NAME>
ploceus dev .
```

After you finished development, use following commands to generate site files:

```bash
# -p stands for production
ploceus build -p .
```

You should see your site been built in the `dist` folder.

## Command Line Arguments

```
$ ploceus build -h

Build a site.

USAGE
  $ ploceus build [PATH]

ARGUMENTS
  PATH  [default: .] source files path

OPTIONS
  -h, --help        show CLI help
  -p, --production  enable production optimization during build.

EXAMPLE
  $ ploceus build
```

```
$ ploceus dev -h
Start development mode.

USAGE
  $ ploceus dev [PATH]

ARGUMENTS
  PATH  [default: .] source files path

OPTIONS
  -h, --help  show CLI help

EXAMPLE
  $ ploceus dev
```

## API

You can use Ploceus programmatically as well.

```js
const { Ploceus } = require('ploceus')

new Ploceus(rootPath, {
  dev: true, // indicates the development mode, otherwise, the build mode
  production: false // production mode enables page minify optimization
})
```
