/**
 * Parity tests using inputs from babel-plugin-relay's test suite.
 * https://github.com/facebook/relay/tree/main/packages/babel-plugin-relay/__tests__
 */
import { describe, it, expect } from 'vitest'
import { getTransformHandler } from './test-utils'

describe('babel-plugin-relay fixture parity', () => {
  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/fixtures/fragment.txt
  it('fragment.txt — production ESM', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `\
'use strict';

const {graphql} = require('relay-runtime');

const testFragment = graphql\`
  fragment TestFragment on User {
    __typename
  }
\`;`
    const result = transform(source, '/test.js')!
    expect(result).not.toBeNull()
    expect(result.code).toContain("import _TestFragment from './__generated__/TestFragment.graphql';")
    expect(result.code).toContain('const testFragment = _TestFragment;')
    expect(result.code).not.toContain('graphql`')
    expect(result.code).not.toContain('console.error')
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/fixtures/query.txt
  it('query.txt — production ESM', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `\
'use strict';

const {graphql} = require('relay-runtime');

const testQuery = graphql\`
  query TestQuery {
    __typename
  }
\`;`
    const result = transform(source, '/test.js')!
    expect(result).not.toBeNull()
    expect(result.code).toContain("import _TestQuery from './__generated__/TestQuery.graphql';")
    expect(result.code).toContain('const testQuery = _TestQuery;')
    expect(result.code).not.toContain('graphql`')
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/fixtures/mutation.txt
  it('mutation.txt — production ESM', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `\
'use strict';

const {graphql} = require('relay-runtime');

const testMutation = graphql\`
  mutation TestMutation($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      __typename
    }
  }
\`;`
    const result = transform(source, '/test.js')!
    expect(result).not.toBeNull()
    expect(result.code).toContain("import _TestMutation from './__generated__/TestMutation.graphql';")
    expect(result.code).toContain('const testMutation = _TestMutation;')
    expect(result.code).not.toContain('graphql`')
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/fixtures/memoize-inner-scope.txt
  it('memoize-inner-scope.txt — graphql tag inside JSX prop', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `\
'use strict';

function SomeTopLevelView() {
  const _graphql = 'unrelated';

  return (
    <View>
      <QueryRenderer
        environment={RelayEnvironment}
        query={graphql\`
          query ExampleQuery($id: ID!) {
            node(id: $id) {
              ...ProfilePic_user
            }
          }
        \`}
        variables={{id: '12345'}}
      />
    </View>
  );
}`
    const result = transform(source, '/test.jsx')!
    expect(result).not.toBeNull()
    expect(result.code).toContain("import _ExampleQuery from './__generated__/ExampleQuery.graphql';")
    expect(result.code).toContain('query={_ExampleQuery}')
    expect(result.code).not.toContain('graphql`')
    expect(result.code).toContain("const _graphql = 'unrelated';")
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/fixtures/too-many-fragments.error.txt
  it('too-many-fragments.error.txt — rejects multiple definitions', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `\
'use strict';

const RelayCompatContainer = require('RelayCompatContainer');
const graphql = require('graphql');

const CompatProfile = () => null;

module.exports = RelayCompatContainer.createContainer(CompatProfile, {
  user: graphql\`
    fragment CompatProfile_user on User {
      name
    }

    fragment CompatProfile_viewer on User {
      name
    }
  \`,
});`
    expect(() => transform(source, '/test.js')).toThrow(
      'Expected exactly one definition per graphql tag',
    )
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/fixtures/unexpected-fragment.error.txt
  it('unexpected-fragment.error.txt — rejects mixed definitions', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `\
'use strict';

const {graphql} = require('relay-runtime');

const testMutation = graphql\`
  mutation CompatCommentCreateMutation($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      viewer {
        actor {
          id
          ...CompatProfilePic_user
        }
      }
    }
  }

  fragment Whoopsie_key on User {
    name
  }
\`;`
    expect(() => transform(source, '/test.js')).toThrow(
      'Expected exactly one definition per graphql tag',
    )
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/fixtures/unexpected-operation.error.txt
  it('unexpected-operation.error.txt — rejects fragment + query mix', () => {
    const transform = getTransformHandler({ isDev: false })
    const source = `\
'use strict';

const {graphql} = require('relay-runtime');

const testFragment = graphql\`
  fragment CompatProfile_user on User {
    name
  }

  query Whoopsie {
    name
  }
\`;`
    expect(() => transform(source, '/test.js')).toThrow(
      'Expected exactly one definition per graphql tag',
    )
  })
})

describe('babel-plugin-relay dev mode parity', () => {
  const devInput = `graphql\`fragment TestFrag on Node { id }\``

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/BabelPluginRelay-test.js
  // "tests the hash when `development` is set"
  it('dev mode — hash check with comma expression', () => {
    const transform = getTransformHandler({ isDev: true })
    const result = transform(devInput, '/test.js')!
    expect(result.code).toContain("import _TestFrag from './__generated__/TestFrag.graphql';")
    expect(result.code).toContain('_TestFrag.hash !== "0bb6b7b29bc3e910921551c4ff5b6757"')
    expect(result.code).toContain('console.error')
    expect(result.code).toContain(', _TestFrag)')
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/BabelPluginRelay-test.js
  // "tests the hash when `isDevVariableName` is set"
  it('dev mode — isDevVariableName ternary', () => {
    const transform = getTransformHandler({ isDevVariableName: 'IS_DEV' })
    const result = transform(devInput, '/test.js')!
    expect(result.code).toContain("import _TestFrag from './__generated__/TestFrag.graphql';")
    expect(result.code).toContain('IS_DEV ?')
    expect(result.code).toContain(': _TestFrag')
    expect(result.code).toContain('console.error')
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/BabelPluginRelay-test.js
  // "uses a custom build command in message"
  it('dev mode — custom codegenCommand', () => {
    const transform = getTransformHandler({ isDev: true, codegenCommand: 'relay-build' })
    const result = transform(devInput, '/test.js')!
    expect(result.code).toContain('Run `relay-build`')
    expect(result.code).toContain('console.error')
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/BabelPluginRelay-test.js
  // "does not test the hash when `development` is not set"
  it('production mode — no hash check', () => {
    const transform = getTransformHandler({ isDev: false })
    const result = transform(devInput, '/test.js')!
    expect(result.code).toContain("import _TestFrag from './__generated__/TestFrag.graphql';")
    expect(result.code).not.toContain('hash')
    expect(result.code).not.toContain('console.error')
    expect(result.code).toMatchSnapshot()
  })
})

describe('babel-plugin-relay variant parity', () => {
  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/BabelPluginRelay-modern-haste-test.js
  it('haste mode — bare filename imports', () => {
    const transform = getTransformHandler({ isDev: false, jsModuleFormat: 'haste' })
    const source = `\
const {graphql} = require('relay-runtime');
const testFragment = graphql\`
  fragment TestFragment on User {
    __typename
  }
\`;`
    const result = transform(source, '/test.js')!
    expect(result.code).toContain("import _TestFragment from 'TestFragment.graphql';")
    expect(result.code).not.toContain('__generated__')
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/BabelPluginRelay-modern-artifact-directory-test.js
  it('artifact directory — relative path from file to artifact dir', () => {
    const transform = getTransformHandler({
      isDev: false,
      artifactDirectory: '/test/artifacts',
    })
    const source = `\
const {graphql} = require('relay-runtime');
const testFragment = graphql\`
  fragment TestFragment on User {
    __typename
  }
\`;`
    const result = transform(source, '/testing/Container.js')!
    expect(result.code).toContain("import _TestFragment from '../test/artifacts/TestFragment.graphql';")
    expect(result.code).toMatchSnapshot()
  })

  // https://github.com/facebook/relay/blob/main/packages/babel-plugin-relay/__tests__/BabelPluginRelay-path-test.js
  it('artifact directory — path from root-adjacent file', () => {
    const transform = getTransformHandler({
      isDev: true,
      artifactDirectory: '/test/artifacts',
    })
    const source = `graphql\`fragment TestFrag on Node { id }\``
    const result = transform(source, '/test.js')!
    expect(result.code).toContain("import _TestFrag from './test/artifacts/TestFrag.graphql';")
    expect(result.code).toMatchSnapshot()
  })
})
