# Ploceus

> Ploceus (weaver birds) are named for their elaborately woven nests. --- [Wikipedia](https://en.wikipedia.org/wiki/Ploceidae)

**Ploceus** is a static site generator that helps you focus on content writing 📖 and style 💄 changing in a **easy & rapid** way.

## Usage

Install it first

```bash
npm install -g ploceus
# Or with yarn
yarn global add ploceus
```

To start build your website, you need to create a work space folder that contains `content` and `theme`. Check [here](https://github.com/YiqinZhao/ploceus-example) for a simple example, it could also be your site template.

Check out [project structure](#project-structure) for detailed file organization. Then, start the development server and create you site!

```
cd <PROJECT_NAME>
ploceus dev
```

Finally, when you are going to build and deploy the site, use:

```bash
ploceus build -p
# -p stands for production
```

You should see your site been built in the `dist` folder.

## Command Line Arguments

```
$ ploceus build -h

build a site.

USAGE
  $ ploceus build [CONTENT] [THEME] [DIST]

ARGUMENTS
  CONTENT  [default: ./content] content folder
  THEME    [default: ./theme] theme folder
  DIST     [default: ./dist] dist folder

OPTIONS
  -h, --help        show CLI help
  -p, --production  enable production optimization during build.

EXAMPLE
  $ ploceus build
```

```
$ ploceus dev -h
watch file changes and rebuild. Also start a dev server.

USAGE
  $ ploceus dev [CONTENT] [THEME] [DIST]

ARGUMENTS
  CONTENT  [default: ./content] content folder
  THEME    [default: ./theme] theme folder
  DIST     [default: ./dist] dist folder

OPTIONS
  -h, --help  show CLI help

EXAMPLE
  $ ploceus dev
```

## API

You can use Ploceus as a normal npm package as well.

```js
const { Ploceus } = require('ploceus')

const p = new Ploceus({
  contentPath: './content',
  themePath: './theme',
  distPath: './dist',
  production: false
})

p.build()

// Watch will only not start a dev server like the command line behavior!
// If you need it, we recommend you use a 3rd package like the browser-sync
p.watch()
```
