/**
 * Sandcastle postMessage transport layer
 *
 * Provides typed duplex communication between the parent window (PreviewPanel.vue)
 * and the sandbox iframe (Sandcastle.vue) via postMessage.
 *
 * Usage (via composables):
 *   const transport = useParentTransport(iframeRef)   // PreviewPanel
 *   const transport = useIframeTransport()             // Sandcastle page
 *
 *   transport.write({ type: 'execute', payload })
 *   for await (const msg of transport.read({ signal })) { ... }
 */

import type { SandcastleShareData } from '~/composables/shareService/common/protocol'

// #region Message types

export interface SandboxReadyMessage { type: 'ready' }
export interface SandboxReloadMessage { type: 'reload' }
export interface SandboxHighlightMessage { type: 'highlight', lineNumber: number }
export interface SandboxLogMessage { type: 'log', level: 'log' | 'error' | 'warn', message: string }
export interface SandboxErrorMessage { type: 'error', message: string, lineNumber?: number, stack?: string }

export type SandboxToParentMessage
  = | SandboxReadyMessage
    | SandboxReloadMessage
    | SandboxHighlightMessage
    | SandboxLogMessage
    | SandboxErrorMessage

export interface ParentExecuteMessage { type: 'execute', payload: SandcastleShareData }

export type ParentToSandboxMessage = ParentExecuteMessage

// #endregion

// #region Transport interface

export interface ITransport<TRead, TWrite> {
  read: (options?: { signal?: AbortSignal }) => AsyncGenerator<TRead>
  write: (msg: TWrite) => void
  dispose: () => void
}

// #endregion

// #region Internal queue

interface Resolver<T> {
  resolve: (value: IteratorResult<T>) => void
}

/**
 * Async-iterable message queue.
 * Buffers messages when no consumer is waiting; resolves waiting consumers immediately.
 * Closed via `close()` — all active iterators will finish after draining the buffer.
 */
class MessageQueue<T> {
  private readonly _buffer: T[] = []
  private readonly _waiting: Resolver<T>[] = []
  private _done = false

  push(msg: T): void {
    if (this._done)
      return
    if (this._waiting.length > 0) {
      this._waiting.shift()!.resolve({ value: msg, done: false })
    }
    else {
      this._buffer.push(msg)
    }
  }

  close(): void {
    this._done = true
    for (const w of this._waiting.splice(0))
      w.resolve({ value: undefined as unknown as T, done: true })
  }

  async* [Symbol.asyncIterator](signal?: AbortSignal): AsyncGenerator<T> {
    while (true) {
      if (signal?.aborted)
        return
      if (this._buffer.length > 0) {
        yield this._buffer.shift()!
        continue
      }
      if (this._done)
        return
      const result = await new Promise<IteratorResult<T>>((resolve, reject) => {
        const resolver: Resolver<T> = { resolve }
        this._waiting.push(resolver)
        signal?.addEventListener('abort', () => {
          const idx = this._waiting.indexOf(resolver)
          if (idx !== -1)
            this._waiting.splice(idx, 1)
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })
      if (result.done)
        return
      yield result.value
    }
  }
}

// #endregion

// #region Transport classes

/**
 * Transport for the parent window side. Instantiate with the sandbox iframe element.
 */
export class ParentTransport implements ITransport<SandboxToParentMessage, ParentToSandboxMessage> {
  private readonly _queue = new MessageQueue<SandboxToParentMessage>()
  private readonly _handler: (event: MessageEvent) => void

  constructor(private readonly _iframe: HTMLIFrameElement) {
    this._handler = (event: MessageEvent) => {
      if (event.source !== _iframe.contentWindow)
        return
      this._queue.push(event.data as SandboxToParentMessage)
    }
    window.addEventListener('message', this._handler)
  }

  write(msg: ParentToSandboxMessage): void {
    this._iframe.contentWindow?.postMessage(msg, '*')
  }

  read(options?: { signal?: AbortSignal }): AsyncGenerator<SandboxToParentMessage> {
    return this._queue[Symbol.asyncIterator](options?.signal)
  }

  dispose(): void {
    window.removeEventListener('message', this._handler)
    this._queue.close()
  }
}

/**
 * Transport for the iframe (sandbox) side. No constructor arguments needed.
 */
export class IframeTransport implements ITransport<ParentToSandboxMessage, SandboxToParentMessage> {
  private readonly _queue = new MessageQueue<ParentToSandboxMessage>()
  private readonly _handler: (event: MessageEvent) => void

  constructor() {
    this._handler = (event: MessageEvent) => {
      this._queue.push(event.data as ParentToSandboxMessage)
    }
    window.addEventListener('message', this._handler)
  }

  write(msg: SandboxToParentMessage): void {
    window.parent.postMessage(msg, '*')
  }

  read(options?: { signal?: AbortSignal }): AsyncGenerator<ParentToSandboxMessage> {
    return this._queue[Symbol.asyncIterator](options?.signal)
  }

  dispose(): void {
    window.removeEventListener('message', this._handler)
    this._queue.close()
  }
}

// #endregion
