import type { FileService, IStats, RollupDirectoryEntry, RollupFileStats, TFlagsCopy } from './protocol'
import { Volume } from 'memfs'

export class FileServiceImpl implements FileService {
  #fs: Volume = Volume.fromJSON({})
  #encoder = new TextEncoder()

  async appendFile(
    path: string,
    data: string | Uint8Array,
    options?: { encoding?: BufferEncoding | null, mode?: string | number, flag?: string | number },
  ): Promise<void> {
    const encoding = options?.encoding ?? undefined
    return await this.#fs.promises.appendFile(path, data, { ...options, encoding })
  }

  async copyFile(source: string, destination: string, mode?: string | TFlagsCopy): Promise<void> {
    // Convert mode to proper flags format if needed
    const flags = typeof mode === 'number' ? mode : undefined
    return await this.#fs.promises.copyFile(source, destination, flags)
  }

  async mkdir(path: string, options?: { recursive?: boolean, mode?: string | number }): Promise<void> {
    await this.#fs.promises.mkdir(path, options)
  }

  async mkdtemp(prefix: string): Promise<string> {
    const dataOut = await this.#fs.promises.mkdtemp(prefix)
    if (typeof dataOut === 'string') {
      return dataOut
    }
    throw new Error('mkdtemp did not return a string')
  }

  readdir(path: string, options?: { withFileTypes?: false }): Promise<string[]>
  readdir(path: string, options?: { withFileTypes: true }): Promise<RollupDirectoryEntry[]>
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | RollupDirectoryEntry[]> {
    return await this.#fs.promises.readdir(path, { withFileTypes: options?.withFileTypes }) as string[] | RollupDirectoryEntry[]
  }

  readFile(
    path: string,
    options?: { encoding?: null, flag?: string | number, signal?: AbortSignal }
  ): Promise<Uint8Array>
  readFile(
    path: string,
    options?: { encoding: BufferEncoding, flag?: string | number, signal?: AbortSignal }
  ): Promise<string>
  async readFile(
    path: string,
    options?: { encoding?: BufferEncoding | null, flag?: string | number, signal?: AbortSignal },
  ): Promise<Uint8Array | string> {
    const encoding = options?.encoding ?? undefined
    const flag = typeof options?.flag === 'string' ? options.flag : undefined

    const fsOptions = {
      encoding,
      ...(flag !== undefined && { flag }),
    }
    const data = await this.#fs.promises.readFile(path, fsOptions)
    if (typeof data === 'string') {
      if (encoding === undefined) {
        return this.#encoder.encode(data)
      }
      return data
    }
    throw new Error('readFile did not return a string')
  }

  async realpath(path: string): Promise<string> {
    const dataOut = await this.#fs.promises.realpath(path)
    if (typeof dataOut === 'string') {
      return dataOut
    }
    throw new Error('realpath did not return a string')
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    return await this.#fs.promises.rename(oldPath, newPath)
  }

  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return await this.#fs.promises.rmdir(path, options)
  }

  async stat(path: string): Promise<RollupFileStats> {
    return await this.#fs.promises.stat(path) as IStats<number>
  }

  async lstat(path: string): Promise<RollupFileStats> {
    return await this.#fs.promises.lstat(path) as IStats<number>
  }

  async unlink(path: string): Promise<void> {
    return await this.#fs.promises.unlink(path)
  }

  async writeFile(
    path: string,
    data: string | Uint8Array,
    options?: { encoding?: BufferEncoding | null, mode?: string | number, flag?: string | number },
  ): Promise<void> {
    const encoding = options?.encoding ?? undefined
    return await this.#fs.promises.writeFile(path, data, { ...options, encoding })
  }
}
