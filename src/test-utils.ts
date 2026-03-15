import { parseAst } from 'rolldown/parseAst'
import relay from './index'

export function getTransformHandler(options?: Parameters<typeof relay>[0]) {
  const plugin = relay(options)
  const transformObj = plugin.transform as {
    handler: (
      code: string,
      id: string,
      meta: { ast?: ReturnType<typeof parseAst> },
    ) => { code: string; map: unknown } | null
  }
  const transform = transformObj.handler
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