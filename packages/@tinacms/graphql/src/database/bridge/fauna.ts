/**
FaunaDB bridge integration.

Allows for a remote backend document store via FaunaDB <https://fauna.com>.
Documents will be stored in the form of:
data: {
  filename: string;
  page: string;
}

Assumptions:
- An operational Fauna database with an access key
- A collection in the Fauna database that has an index named 'page_by_filename'
  with 'data.filename' as it's only term
- Does not use or care about rootPath, this might change in the future

Currently, the Bridge will not check for the existence of the index or attempt
to create one if it does not exist.

In order to use the Fauna bridge with the Memory store, edit
`packages/@tinacms/cli/src/cmds/start-server/index.ts`
``
-  const bridge = new FilesystemBridge(rootPath)
-  const store = experimentalData
-    ? new LevelStore(rootPath)
-    : new FilesystemStore({ rootPath })
+  const bridge = new FaunaBridge({
+    accessToken: '<my-fauna-key>',
+    domain: '<my-fauna-domain>',
+    collection: '<my-collection-name',
+    rootPath: rootPath,
+  })
+  const store = new MemoryStore(rootPath)
``
*/

import { Bridge } from '.'
import faunadb, { Client as FaunadbClient } from 'faunadb'
import { GraphQLError } from 'graphql'

const fq = faunadb.query

export interface FaunaReadDirQueryResult {
  data: string[]
}

export interface FaunaInit {
  accessToken: string
  domain: string
  collection: string
  rootPath: string
}
export class FaunaBridge implements Bridge {
  rootPath: string
  collection: string
  faunaClient: FaunadbClient

  constructor({ accessToken, domain, collection, rootPath }: FaunaInit) {
    this.rootPath = rootPath
    this.collection = collection
    this.faunaClient = new faunadb.Client({
      secret: accessToken,
      domain: domain,
      port: 443,
      scheme: 'https',
    })
  }

  private async readDir(filepath: string): Promise<string[]> {
    let documents = (await this.faunaClient.query(
      fq.Map(
        fq.Paginate(
          fq.Filter(
            fq.Documents(fq.Collection(this.collection)),
            fq.Lambda(
              'doc',
              fq.GT(
                fq.Count(
                  fq.FindStrRegex(
                    fq.Select(['data', 'filename'], fq.Get(fq.Var('doc'))),
                    `^${filepath}`
                  )
                ),
                0
              )
            )
          ),
          { size: 12000 }
        ),
        fq.Lambda(
          'docref',
          fq.Select(['data', 'filename'], fq.Get(fq.Var('docref')))
        )
      )
    )) as FaunaReadDirQueryResult
    if (documents.data !== undefined) {
      return documents.data
    }
    return []
  }
  public supportsBuilding() {
    return true
  }

  public async glob(pattern: string) {
    const results = await this.readDir(pattern)
    return results
  }

  public async get(filepath: string) {
    try {
      let page: string = await this.faunaClient.query(
        fq.Select(
          ['data', 'page'],
          fq.Get(fq.Match(fq.Index('page_by_filename'), filepath))
        )
      )
      if (page !== undefined) {
        return page
      }
      return ''
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new GraphQLError(
          `Unauthorized request to Fauna Database: please ensure your access token is valid.`,
          null,
          null,
          null,
          null,
          e,
          { status: e.message }
        )
      }
      throw new GraphQLError(
        `Unknown error request to Fauna Database: please ensure your access token is valid.`,
        null,
        null,
        null,
        null,
        null,
        { status: '' }
      )
    }
  }
  public async putConfig(filepath: string, data: string) {
    await this.put(filepath, data)
  }

  public async put(filepath: string, data: string) {
    await this.faunaClient.query(
      fq.Let(
        {
          match: fq.Match(fq.Index('page_by_filename'), filepath),
        },
        fq.If(
          fq.IsEmpty(fq.Var('match')),
          fq.Create(this.collection, {
            data: {
              filename: filepath,
              page: data,
            },
          }),
          fq.Update(fq.Select('ref', fq.Get(fq.Var('match'))), {
            data: {
              filename: filepath,
              page: data,
            },
          })
        )
      )
    )
  }
}
