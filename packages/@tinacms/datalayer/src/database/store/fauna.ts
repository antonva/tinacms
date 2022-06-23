import { LevelStore } from './level'

export class FaunaStore extends LevelStore {
  constructor(rootPath: string, useMemory: boolean = false) {
    super(rootPath, useMemory)
  }
  public supportsSeeding() {
    return true
  }
  public supportsIndexing() {
    return false
  }
}
