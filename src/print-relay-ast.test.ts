/**
 * Parity tests for the TS port of relay-compiler's print_ast_to_text.rs.
 * Each expected output below was derived by walking the Rust printer's rules
 * over the corresponding parsed AST.
 */
import { describe, it, expect } from 'vitest'
import { parse } from 'graphql'
import { printRelayAst } from './print-relay-ast'

function printSource(src: string): string {
  return printRelayAst(parse(src).definitions[0])
}

describe('printRelayAst — relay-compiler parity', () => {
  it('prints a simple fragment', () => {
    const out = printSource(`fragment TestFrag on Node { id }`)
    expect(out).toBe(`fragment TestFrag on Node {\n  id\n}`)
  })

  it('prints a simple query', () => {
    const out = printSource(`query TestQuery { __typename }`)
    expect(out).toBe(`query TestQuery {\n  __typename\n}`)
  })

  it('prints a mutation with variable definitions', () => {
    const out = printSource(`
      mutation TestMutation($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          __typename
        }
      }
    `)
    expect(out).toBe(
      `mutation TestMutation($input: CommentCreateInput!) {\n` +
        `  commentCreate(input: $input) {\n` +
        `    __typename\n` +
        `  }\n` +
        `}`,
    )
  })

  // Bug repro: long argument lists must NOT wrap (graphql-js's print() wraps these,
  // which is why hashes diverged from relay-compiler's artifact for non-trivial ops).
  it('does not wrap long argument lists (the bug from issue)', () => {
    const out = printSource(`
      mutation X(
        $taskId: ID!
        $dayOfWeek: DayOfWeek!
        $daySection: DaySection!
        $connections: [ID!]!
      ) {
        createRoutineSlot(
          input: {taskId: $taskId, dayOfWeek: $dayOfWeek, section: $daySection}
        ) {
          slot @appendNode(connections: $connections, edgeTypeName: "RoutineSlotEdge") {
            id
          }
        }
      }
    `)
    expect(out).toBe(
      `mutation X($taskId: ID!, $dayOfWeek: DayOfWeek!, $daySection: DaySection!, $connections: [ID!]!) {\n` +
        `  createRoutineSlot(input: {taskId: $taskId, dayOfWeek: $dayOfWeek, section: $daySection}) {\n` +
        `    slot @appendNode(connections: $connections, edgeTypeName: "RoutineSlotEdge") {\n` +
        `      id\n` +
        `    }\n` +
        `  }\n` +
        `}`,
    )
  })

  it('prints fragment with @updatable directive', () => {
    const out = printSource(`fragment EditTaskUpdatable on Task @updatable {
      id
      title
    }`)
    expect(out).toBe(
      `fragment EditTaskUpdatable on Task @updatable {\n` +
        `  id\n` +
        `  title\n` +
        `}`,
    )
  })

  it('prints inline fragment with type condition', () => {
    const out = printSource(`fragment F on Node {
      ... on User {
        name
      }
    }`)
    expect(out).toBe(
      `fragment F on Node {\n` +
        `  ... on User {\n` +
        `    name\n` +
        `  }\n` +
        `}`,
    )
  })

  it('prints fragment spread with directive', () => {
    const out = printSource(`fragment F on Node {
      ...Other @defer
    }`)
    expect(out).toBe(`fragment F on Node {\n  ...Other @defer\n}`)
  })

  it('prints field alias and arguments', () => {
    const out = printSource(`query Q {
      foo: bar(x: 1, y: "hi", z: ENUM_VAL, w: null, b: true, l: [1, 2], o: {k: 1})
    }`)
    expect(out).toBe(
      `query Q {\n` +
        `  foo: bar(x: 1, y: "hi", z: ENUM_VAL, w: null, b: true, l: [1, 2], o: {k: 1})\n` +
        `}`,
    )
  })

  it('prints variable default values and list/non-null types', () => {
    const out = printSource(`query Q($a: [Int!]! = [1, 2], $b: String = "x") { id }`)
    expect(out).toBe(
      `query Q($a: [Int!]! = [1, 2], $b: String = "x") {\n  id\n}`,
    )
  })

  it('prints nested linked fields with correct indentation', () => {
    const out = printSource(`fragment F on Node {
      a {
        b {
          c {
            d
          }
        }
      }
    }`)
    expect(out).toBe(
      `fragment F on Node {\n` +
        `  a {\n` +
        `    b {\n` +
        `      c {\n` +
        `        d\n` +
        `      }\n` +
        `    }\n` +
        `  }\n` +
        `}`,
    )
  })

  it('emits no trailing newline', () => {
    const out = printSource(`fragment F on Node { id }`)
    expect(out.endsWith('}')).toBe(true)
    expect(out.endsWith('\n')).toBe(false)
  })
})
