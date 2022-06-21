import { LevelStore } from './level'

export class FaunaStore extends LevelStore {
  constructor(rootPath: string, useMemory: boolean = false) {
    super(rootPath, useMemory)
  }
  public supportsSeeding() {
    return false
  }
  public supportsIndexing() {
    return false
  }
}
