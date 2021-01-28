import fs from "fs"
import { Ploceus } from "./core/index"

fs.rmSync("/Users/yiqinzhao/Desktop/coden/yiqinzhao-src-v5/dist", { recursive: true, force: true })
let tree = new Ploceus("/Users/yiqinzhao/Desktop/coden/yiqinzhao-src-v5")
