export class ReadCache<T> {
  private value: T | undefined
  private expiresAt = 0
  private pending: Promise<T> | undefined

  constructor(private readonly ttlMs = 60_000) {}

  get(load: () => Promise<T>): Promise<T> {
    if (this.value !== undefined && Date.now() < this.expiresAt) {
      return Promise.resolve(this.value)
    }
    if (this.pending) return this.pending

    this.pending = load().then((value) => {
      this.value = value
      this.expiresAt = Date.now() + this.ttlMs
      return value
    }).finally(() => {
      this.pending = undefined
    })
    return this.pending
  }
}
