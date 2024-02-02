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
- A collection in the Fauna database that has an index named 'pageByFileName'
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

import type { Bridge } from './index'

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
  domain: string

  constructor({ domain, collection, rootPath }: FaunaInit) {
    this.rootPath = rootPath
    this.collection = collection
    this.domain = domain
  }

  private async readDir(filepath: string): Promise<string[]> {
    const documents = await fetch(`${this.domain}/page-dir`, {
      method: 'POST',
      body: JSON.stringify({ filepath: filepath }),
    })
    if (documents.ok) {
      const result = await documents.json()
      if (result.data !== undefined) {
        return result.data
      }
    }
    return []
  }

  public supportsBuilding() {
    return true
  }

  public async delete(filepath: string) {
    await fetch(`${this.domain}/page`, {
      method: 'DELETE',
      body: JSON.stringify({ filepath: filepath }),
    })
  }

  public async glob(pattern: string) {
    const results = await this.readDir(pattern)
    console.log('glob', results)
    return results
  }

  public async get(filepath: string) {
    console.log('get', filepath)
    const page = await fetch(`${this.domain}/page?filepath=${filepath}`, {
      method: 'GET',
    })
    if (page !== undefined && page.ok) {
      return page.json()
    }
    return ''
  }

  public async putConfig(filepath: string, data: string) {
    await this.put(filepath, data)
  }

  public async put(filepath: string, data: string) {
    const response = await fetch(`${this.domain}/page`, {
      method: 'POST',
      body: JSON.stringify({
        filepath,
        data,
      }),
    })
    return response.ok ? response.json() : ''
  }
}
