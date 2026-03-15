import { createHash } from 'crypto'
import { dirname, join, relative, resolve } from 'path'
import { parse as parseGraphQL, print } from 'graphql'
import MagicString from 'magic-string'
import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import type { Plugin } from 'rolldown'
import type { Program, TaggedTemplateExpression } from '@oxc-project/types'

export interface RelayPluginOptions {
  artifactDirectory?: string
  isDev?: boolean
  isDevVariableName?: string
  eagerEsModules?: boolean
  jsModuleFormat?: 'commonjs' | 'haste'
  codegenCommand?: string
}

function posixify(path: string): string {
  return process.platform === 'win32' ? path.replace(/\\/g, '/') : path
}

function isGraphqlTag(node: TaggedTemplateExpression): boolean {
  return node.tag.type === 'Identifier' && node.tag.name === 'graphql'
}

function langFromId(id: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  if (id.endsWith('.tsx')) return 'tsx'
  if (id.endsWith('.ts')) return 'ts'
  if (id.endsWith('.jsx')) return 'jsx'
  return 'js'
}

// Vite needs `enforce` to run before vite:oxc, Rolldown ignores it
interface VitePluginCompat {
  enforce: 'pre'
}

export default function relay(options?: RelayPluginOptions): Plugin & VitePluginCompat {
  const isDev = options?.isDev ?? true
  const isDevVariableName = options?.isDevVariableName
  const eagerEsModules = options?.eagerEsModules ?? true
  const isHasteMode = options?.jsModuleFormat === 'haste'
  const codegenCommand = options?.codegenCommand ?? 'relay-compiler'
  const artifactDirectory = options?.artifactDirectory

  return {
    name: 'rolldown-plugin-relay',
    enforce: 'pre',
    transform(code, id, meta) {
      if (!/\.[jt]sx?$/.test(id)) return null
      if (!code.includes('graphql`')) return null

      // Prefer the AST from Rolldown's transform hook (meta.ast) when available,
      // as it avoids a redundant parse. Vite 8's dev server does not pass meta.ast
      // to plugins, so we fall back to parsing with oxc-parser ourselves. If Vite
      // exposes meta.ast in a future version, the fallback will no longer be needed.
      const ast: Program =
        meta?.ast ?? parseSync(id, code, { lang: langFromId(id) }).program

      const tags: TaggedTemplateExpression[] = []
      walk(ast, {
        enter(node) {
          if (node.type === 'TaggedTemplateExpression' && isGraphqlTag(node)) {
            tags.push(node)
            this.skip()
          }
        },
      })

      if (tags.length === 0) return null

      const output = new MagicString(code)
      const imports: string[] = []
      const usedNames = new Set<string>()

      for (const tag of tags) {
        const quasi = tag.quasi
        if (quasi.expressions.length > 0) {
          throw new Error(
            'rolldown-plugin-relay: Interpolations in graphql tags are not supported by Relay.',
          )
        }

        const graphqlText =
          quasi.quasis[0].value.cooked ?? quasi.quasis[0].value.raw
        const doc = parseGraphQL(graphqlText)

        if (doc.definitions.length !== 1) {
          throw new Error(
            'rolldown-plugin-relay: Expected exactly one definition per graphql tag.',
          )
        }

        const definition = doc.definitions[0]
        if (
          definition.kind !== 'FragmentDefinition' &&
          definition.kind !== 'OperationDefinition'
        ) {
          throw new Error(
            `rolldown-plugin-relay: Expected a fragment, mutation, query, or subscription, got \`${definition.kind}\`.`,
          )
        }

        const definitionName = definition.name?.value
        if (!definitionName) {
          throw new Error(
            'rolldown-plugin-relay: GraphQL operations and fragments must contain names.',
          )
        }

        let importName = `_${definitionName}`
        while (usedNames.has(importName)) {
          importName = `_${importName}`
        }
        usedNames.add(importName)

        const requiredFile = `${definitionName}.graphql`
        let importPath: string
        if (isHasteMode) {
          importPath = requiredFile
        } else if (artifactDirectory) {
          const rel = relative(dirname(id), resolve(artifactDirectory))
          const prefix =
            rel.length === 0 || !rel.startsWith('.') ? './' : ''
          importPath = posixify(prefix + join(rel, requiredFile))
        } else {
          importPath = `./__generated__/${requiredFile}`
        }

        const hash = createHash('md5')
          .update(print(definition), 'utf8')
          .digest('hex')
        const errorMsg = `The definition of '${definitionName}' appears to have changed. Run \`${codegenCommand}\` to update the generated files to receive the expected data.`
        const hashCheck = `${importName}.hash !== null && ${importName}.hash !== "${hash}" && console.error("${errorMsg}")`

        let replacement: string
        if (eagerEsModules) {
          imports.push(`import ${importName} from '${importPath}';`)

          const devExpr = `(${hashCheck}, ${importName})`
          if (isDevVariableName) {
            replacement = `${isDevVariableName} ? ${devExpr} : ${importName}`
          } else if (isDev) {
            replacement = devExpr
          } else {
            replacement = importName
          }
        } else {
          imports.push(`var ${importName};`)

          const assignExpr = `${importName} = require('${importPath}')`
          const devExpr = `(${assignExpr}, ${hashCheck}, ${importName})`
          const prodExpr = `(${assignExpr})`

          let innerExpr: string
          if (isDevVariableName) {
            innerExpr = `${isDevVariableName} ? ${devExpr} : ${prodExpr}`
          } else if (isDev) {
            innerExpr = devExpr
          } else {
            innerExpr = prodExpr
          }

          replacement = `${importName} !== void 0 ? ${importName} : ${innerExpr}`
        }

        output.overwrite(tag.start, tag.end, replacement)
      }

      output.prepend(imports.join('\n') + '\n')

      return {
        code: output.toString(),
        map: output.generateMap({ hires: true }),
      }
    },
  }
}
