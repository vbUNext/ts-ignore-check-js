/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/ban-ts-ignore */
/* eslint-disable unicorn/catch-error-name */
import {Command, flags} from '@oclif/command'
import execa from 'execa'
import ora from 'ora'
import {mapSeries} from 'bluebird'
import path from 'path'
import pkgDir from 'pkg-dir'
import {oc} from 'ts-optchain.macro'
// @ts-ignore
import {readFile, writeFile} from 'fs-extra'

interface File {
  count: number;
  lines: string[];
  path: string;
}

interface Files {
  [key: string]: File;
}

const rootPath = pkgDir.sync(process.cwd()) || process.cwd()

class TsIgnoreCheckJs extends Command {
  static description = 'describe the command here';

  static flags = {
    // add --version flag to show CLI version
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({char: 'n', description: 'name to print'}),
    // flag with no value (-f, --force)
    force: flags.boolean({char: 'f'}),
  };

  static args = [{name: 'file'}];

  async run() {
    // const {args, flags} = this.parse(TsIgnoreCheckJs)

    const spinner = ora()
    spinner.start('finding errors')
    const files: Files = {}
    const lines = (
      await execa('tsc', ['--noEmit', '--allowJs', '--checkJs'], {
        cwd: rootPath,
      }).catch(err => {
        console.log('🚀 ~ err', err)
        if (err.stdout) return err
        throw err
      })
    ).stdout.split('\n')
    console.log('🚀 ~  ~ lines', lines)
    spinner.start('fixing errors')
    let count = 0
    await mapSeries(lines, async (line: string) => {
      const [, filePath, lineNumber] = line.match(
        /(.+\.((tsx?)|(js)))\((\d+),\d+\): error TS\d{4}: /
      ) || [null, null, null]
      if (!filePath) return
      console.log('🚀 ~  ~ filePath', filePath)
      console.log('🚀 ~  ~ lineNumber', lineNumber)
      if (!(filePath in files)) {
        files[filePath] = {
          count: 0,
          lines: (await readFile(filePath)).toString().split('\n'),
          path: path.resolve(process.cwd(), filePath),
        }
      }
      ++count
      const file = files[filePath]
      const padding: number = oc(
        file.lines[Number(lineNumber) + file.count - 1].match(/^ */)
      )([''])[0].length
      file.lines.splice(
        Number(lineNumber) + file.count - 1,
        0,
        `${new Array(padding).fill(' ').join('')}// @ts-ignore`
      )
      ++file.count
    })
    await Promise.all(
      Object.values(files).map(async (file: File) => {
        await writeFile(file.path, file.lines.join('\n'))
      })
    )
    spinner.succeed(`fixed ${count} errors`)
  }
}

export = TsIgnoreCheckJs;
