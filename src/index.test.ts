import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { parse as parseGraphQL, print } from 'graphql'
import { parseAst } from 'rolldown/parseAst'
import relay from './index'

function getTransformHandler(options?: Parameters<typeof relay>[0]) {
  const plugin = relay(options)
  const transform = plugin.transform as (
    code: string,
    id: string,
    meta: { ast?: ReturnType<typeof parseAst> },
  ) => { code: string; map: unknown } | null
  return (code: string, id = '/src/Component.tsx') => {
    const lang = id.endsWith('.tsx')
      ? 'tsx'
      : id.endsWith('.ts')
        ? 'ts'
        : id.endsWith('.jsx')
          ? 'jsx'
          : 'js'
    const ast = parseAst(code, { lang }, id)
    return transform.call({}, code, id, { ast })
  }
}

function md5(graphqlSource: string): string {
  const doc = parseGraphQL(graphqlSource)
  return createHash('md5')
    .update(print(doc.definitions[0]), 'utf8')
    .digest('hex')
}

describe('rolldown-plugin-relay', () => {
  it('returns null for files without graphql tags', () => {
    const transform = getTransformHandler()
    const result = transform('const x = 1;')
    expect(result).toBeNull()
  })

  it('transforms a single fragment (dev mode)', () => {
    const transform = getTransformHandler({ isDev: true })
    const source = `
import { graphql, useFragment } from 'react-relay';
const fragment = useFragment(graphql\`
  fragment TaskDisplay on Task {
    id
    title
  }
\`, taskRef);`

    const result = transform(source)!
    expect(result).not.toBeNull()

    expect(result.code).toContain(
      "import _TaskDisplay from './__generated__/TaskDisplay.graphql';",
    )
    expect(result.code).not.toContain('graphql`')

    const hash = md5(`fragment TaskDisplay on Task { id title }`)
    expect(result.code).toContain(`_TaskDisplay.hash !== "${hash}"`)
    expect(result.code).toContain('console.error')
    expect(result.code).toContain(', _TaskDisplay)')
  })

  it('transforms a single query (dev mode)', () => {
    const transform = getTransformHandler({ isDev: true })
    const source = `
import { graphql, usePreloadedQuery } from 'react-relay';
const data = usePreloadedQuery(graphql\`
  query TasksPageQuery {
    hello
  }
\`, queryRef);`

    const result = transform(source)!
    expect(result).not.toBeNull()
    expect(result.code).toContain(
      "import _TasksPageQuery from './__generated__/TasksPageQuery.graphql';",
    )
    expect(result.code).toContain('_TasksPageQuery.hash !== null')
  })

  it('transforms multiple graphql tags in one file', () => {
    const transform = getTransformHandler({ isDev: true })
    const source = `
import { graphql, useMutation } from 'react-relay';

const [commit] = useMutation(graphql\`
  mutation EditTaskMutation($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      task { id }
    }
  }
\`);

const updatable = graphql\`
  fragment EditTaskUpdatable on Task @updatable {
    id
    title
  }
\`;`

    const result = transform(source)!
    expect(result).not.toBeNull()
    expect(result.code).toContain(
      "import _EditTaskMutation from './__generated__/EditTaskMutation.graphql';",
    )
    expect(result.code).toContain(
      "import _EditTaskUpdatable from './__generated__/EditTaskUpdatable.graphql';",
    )
    expect(result.code).not.toContain('graphql`')
  })

  it('produces plain reference in prod mode (isDev: false)', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `
const data = useFragment(graphql\`
  fragment Foo on Bar { id }
\`, ref);`

    const result = transform(source)!
    expect(result).not.toBeNull()
    expect(result.code).toContain(
      "import _Foo from './__generated__/Foo.graphql';",
    )
    expect(result.code).not.toContain('console.error')
    expect(result.code).not.toContain('.hash')
    expect(result.code).toContain('useFragment(_Foo, ref)')
  })

  it('uses artifactDirectory for import paths', () => {
    const transform = getTransformHandler({
      isDev: false,
      artifactDirectory: '/src/__generated__',
    })
    const source = `const x = graphql\`fragment Foo on Bar { id }\`;`
    const result = transform(source, '/src/components/deep/Component.tsx')!

    expect(result).not.toBeNull()
    expect(result.code).toContain(
      "import _Foo from '../../__generated__/Foo.graphql';",
    )
  })

  it('generates a sourcemap', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `const x = graphql\`fragment Foo on Bar { id }\`;`
    const result = transform(source)!
    expect(result.map).toBeDefined()
  })

  it('uses custom codegenCommand in error message', () => {
    const transform = getTransformHandler({
      isDev: true,
      codegenCommand: 'pnpm relay',
    })
    const source = `const x = graphql\`fragment Foo on Bar { id }\`;`
    const result = transform(source)!
    expect(result.code).toContain('Run `pnpm relay`')
  })

  it('generates memoized require() when eagerEsModules is false (prod)', () => {
    const transform = getTransformHandler({ eagerEsModules: false, isDev: false })
    const source = `const x = graphql\`fragment Foo on Bar { id }\`;`
    const result = transform(source)!
    expect(result.code).toContain('var _Foo;')
    expect(result.code).not.toContain('import ')
    expect(result.code).toContain("_Foo !== void 0 ? _Foo : (_Foo = require('./__generated__/Foo.graphql'))")
  })

  it('generates memoized require() with hash check when eagerEsModules is false (dev)', () => {
    const transform = getTransformHandler({ eagerEsModules: false, isDev: true })
    const source = `const x = graphql\`fragment Foo on Bar { id }\`;`
    const result = transform(source)!
    expect(result.code).toContain('var _Foo;')
    expect(result.code).toContain("_Foo = require('./__generated__/Foo.graphql')")
    expect(result.code).toContain('console.error')
    expect(result.code).toContain('_Foo !== void 0 ? _Foo :')
  })

  it('uses bare filename in haste mode', () => {
    const transform = getTransformHandler({ isDev: false, jsModuleFormat: 'haste' })
    const source = `const x = graphql\`fragment Foo on Bar { id }\`;`
    const result = transform(source)!
    expect(result.code).toContain("import _Foo from 'Foo.graphql';")
    expect(result.code).not.toContain('__generated__')
  })

  it('wraps hash check in runtime conditional when isDevVariableName is set', () => {
    const transform = getTransformHandler({ isDevVariableName: '__DEV__' })
    const source = `const x = graphql\`fragment Foo on Bar { id }\`;`
    const result = transform(source)!
    expect(result.code).toContain('__DEV__ ?')
    expect(result.code).toContain('console.error')
    expect(result.code).toContain(': _Foo')
  })

  it('ignores graphql in comments and strings', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `
// graphql\`fragment Fake on Bar { id }\`
const str = "graphql\`fragment Fake2 on Bar { id }\`";
const x = 1;`

    const result = transform(source)
    expect(result).toBeNull()
  })
})
