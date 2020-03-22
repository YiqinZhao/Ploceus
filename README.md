# Ploceus

> Ploceus (weaver birds) are named for their elaborately woven nests. --- [Wikipedia](https://en.wikipedia.org/wiki/Ploceidae)

**Ploceus** is a static site generator that helps you focus on content writing 📖 while also enables **easy & rapid** style 💄 changes.

## Usage

Install it first

```bash
npm install -g ploceus
# Or with yarn
yarn global add ploceus
```

Create a project folder with

```bash
ploceus init <PROJECT_NAME>
```

This command creates an project folder and setup every thing for you. You should see a folder stricture like:

```
.
├── content
│   ├── index
│   │   ├── main.md
│   │   └── conf.yaml
│   ├── posts
│   │   ├── foo
│   │   │   ├── conf.yaml
│   │   │   └── main.md
│   │   ├── bar
│   │   │   ├── conf.yaml
│   │   │   └── main.md
│   │   └── conf.yaml
│   └── site.yaml
└── theme
    └── ...
```

This is a sample setup for Ploceus project. Check out [project structure](#project-structure) for detailed file organization. Then, start the development server and create you site!

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

## Project Structure

## Command Line Arguments

## API

You can use Ploceus as a normal npm package as well.
