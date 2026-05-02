/**
 * Port of relay-compiler's `print_executable_definition_ast` (Rust) to TS,
 * walking a graphql-js AST instead of relay-syntax. The relay-compiler writes
 * the artifact's `hash` field as md5(this output), so the plugin must produce
 * byte-identical output to keep dev-mode hash checks from spuriously firing.
 *
 * Reference: relay/compiler/crates/graphql-text-printer/src/print_ast_to_text.rs
 *
 * Key difference from graphql-js's `print()`: this printer never wraps argument
 * or variable lists across lines, regardless of length.
 */
import type {
  ArgumentNode,
  DefinitionNode,
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionNode,
  TypeNode,
  ValueNode,
  VariableDefinitionNode,
} from 'graphql'

export function printRelayAst(node: DefinitionNode): string {
  if (node.kind === 'OperationDefinition') return printOperation(node)
  if (node.kind === 'FragmentDefinition') return printFragment(node)
  throw new Error(
    `rolldown-plugin-relay: unsupported definition kind \`${node.kind}\`.`,
  )
}

function printOperation(op: OperationDefinitionNode): string {
  let out: string = op.operation
  if (op.name) out += ` ${op.name.value}`
  if (op.variableDefinitions && op.variableDefinitions.length > 0) {
    out += printVariableDefinitions(op.variableDefinitions)
  }
  out += printDirectives(op.directives)
  out += ' {\n'
  out += printSelections(op.selectionSet.selections, '  ')
  out += '}'
  return out
}

function printFragment(frag: FragmentDefinitionNode): string {
  let out = `fragment ${frag.name.value}`
  out += ` on ${frag.typeCondition.name.value}`
  out += printDirectives(frag.directives)
  out += ' {\n'
  out += printSelections(frag.selectionSet.selections, '  ')
  out += '}'
  return out
}

function printVariableDefinitions(
  vars: ReadonlyArray<VariableDefinitionNode>,
): string {
  return '(' + vars.map(printVariableDefinition).join(', ') + ')'
}

function printVariableDefinition(v: VariableDefinitionNode): string {
  let s = `$${v.variable.name.value}: ${printType(v.type)}`
  if (v.defaultValue) s += ` = ${printValue(v.defaultValue)}`
  s += printDirectives(v.directives)
  return s
}

function printDirectives(
  directives: ReadonlyArray<DirectiveNode> | undefined,
): string {
  if (!directives || directives.length === 0) return ''
  return directives.map(printDirective).join('')
}

function printDirective(d: DirectiveNode): string {
  let s = ` @${d.name.value}`
  if (d.arguments && d.arguments.length > 0) s += printArguments(d.arguments)
  return s
}

function printArguments(args: ReadonlyArray<ArgumentNode>): string {
  return (
    '(' +
    args.map((a) => `${a.name.value}: ${printValue(a.value)}`).join(', ') +
    ')'
  )
}

function printType(t: TypeNode): string {
  if (t.kind === 'NamedType') return t.name.value
  if (t.kind === 'ListType') return `[${printType(t.type)}]`
  return `${printType(t.type)}!`
}

function printValue(v: ValueNode): string {
  switch (v.kind) {
    case 'Variable':
      return `$${v.name.value}`
    case 'IntValue':
      return v.value
    case 'FloatValue':
      return v.value
    case 'StringValue':
      return v.block ? `"""${v.value}"""` : `"${v.value}"`
    case 'BooleanValue':
      return v.value ? 'true' : 'false'
    case 'NullValue':
      return 'null'
    case 'EnumValue':
      return v.value
    case 'ListValue':
      return '[' + v.values.map(printValue).join(', ') + ']'
    case 'ObjectValue':
      return (
        '{' +
        v.fields
          .map((f) => `${f.name.value}: ${printValue(f.value)}`)
          .join(', ') +
        '}'
      )
  }
  // graphql-js's ValueNode is a closed union; this is unreachable.
  throw new Error(`printValue: unknown value kind`)
}

function printSelections(
  selections: ReadonlyArray<SelectionNode>,
  indent: string,
): string {
  let out = ''
  for (const sel of selections) {
    out += indent + printSelection(sel, indent) + '\n'
  }
  return out
}

function printSelection(sel: SelectionNode, indent: string): string {
  switch (sel.kind) {
    case 'Field':
      return printField(sel, indent)
    case 'FragmentSpread':
      return printFragmentSpread(sel)
    case 'InlineFragment':
      return printInlineFragment(sel, indent)
  }
  // graphql-js's SelectionNode is a closed union; this is unreachable.
  throw new Error(`printSelection: unknown selection kind`)
}

function printField(field: FieldNode, indent: string): string {
  let s = ''
  if (field.alias) s += `${field.alias.value}: `
  s += field.name.value
  if (field.arguments && field.arguments.length > 0) {
    s += printArguments(field.arguments)
  }
  s += printDirectives(field.directives)
  if (field.selectionSet) {
    s += ' {\n'
    s += printSelections(field.selectionSet.selections, '  ' + indent)
    s += `${indent}}`
  }
  return s
}

function printFragmentSpread(node: FragmentSpreadNode): string {
  return `...${node.name.value}` + printDirectives(node.directives)
}

function printInlineFragment(node: InlineFragmentNode, indent: string): string {
  let s = '...'
  if (node.typeCondition) s += ` on ${node.typeCondition.name.value}`
  s += printDirectives(node.directives)
  s += ' {\n'
  s += printSelections(node.selectionSet.selections, '  ' + indent)
  s += `${indent}}`
  return s
}
