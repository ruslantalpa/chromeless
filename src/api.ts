import ChromeLocal from './chrome/local'
import ChromeRemote from './chrome/remote'
import Queue from './queue'
import { ChromelessOptions, Cookie, CookieQuery, PdfOptions, DeviceMetrics } from './types'
import { getDebugOption } from './util'

export default class Chromeless<T extends any> implements Promise<T> {
  private queue: Queue
  private lastReturnPromise: Promise<any>

  constructor(options: ChromelessOptions = {}, copyInstance?: Chromeless<any>) {
    if (copyInstance) {
      this.queue = copyInstance.queue
      this.lastReturnPromise = copyInstance.lastReturnPromise
      return
    }

    const mergedOptions: ChromelessOptions = {
      debug: getDebugOption(),
      waitTimeout: 10000,
      remote: false,
      implicitWait: true,
      launchChrome: true,

      ...options,

      viewport: {
        scale: 1,
        ...options.viewport,
      },

      cdp: {
        host: process.env['CHROMELESS_CHROME_HOST'] || 'localhost',
        port: parseInt(process.env['CHROMELESS_CHROME_PORT'], 10) || 9222,
        secure: false,
        closeTab: true,
        ...options.cdp,
      },

      launch: {
        ...options.launch
      },
    }

    const chrome = mergedOptions.remote
      ? new ChromeRemote(mergedOptions)
      : new ChromeLocal(mergedOptions)

    this.queue = new Queue(chrome)

    this.lastReturnPromise = Promise.resolve(undefined)
  }

  /*
   * The following 3 members are needed to implement a Promise
   */
  readonly [Symbol.toStringTag]: 'Promise'

  then<U>(
    onFulfill?: ((value: T) => U | PromiseLike<U>) | null,
    onReject?: ((error: any) => U | PromiseLike<U>) | null,
  ): Promise<U> {
    return this.lastReturnPromise.then(onFulfill, onReject) as Promise<U>
  }

  catch<U>(onrejected?: (reason: any) => U | PromiseLike<U>): Promise<U> {
    return this.lastReturnPromise.catch(onrejected) as Promise<U>
  }

  goto(url: string): Chromeless<T> {
    this.queue.enqueue({ type: 'goto', url })

    return this
  }

  setUserAgent(useragent: string): Chromeless<T> {
    this.queue.enqueue({ type: 'setUserAgent', useragent })

    return this
  }

  click(selector: string): Chromeless<T> {
    this.queue.enqueue({ type: 'click', selector })

    return this
  }

  wait(timeout: number): Chromeless<T>
  wait(selector: string): Chromeless<T>
  wait(fn: (...args: any[]) => boolean, ...args: any[]): Chromeless<T>
  wait(firstArg, ...args: any[]): Chromeless<T> {
    switch (typeof firstArg) {
      case 'number': {
        this.queue.enqueue({ type: 'wait', timeout: firstArg })
        break
      }
      case 'string': {
        this.queue.enqueue({ type: 'wait', selector: firstArg })
        break
      }
      case 'function': {
        this.queue.enqueue({ type: 'wait', fn: firstArg, args })
        break
      }
      default:
        throw new Error(`Invalid wait arguments: ${firstArg} ${args}`)
    }

    return this
  }

  focus(selector: string): Chromeless<T> {
    this.queue.enqueue({ type: 'focus', selector })
    return this
  }

  press(keyCode: number, count?: number, modifiers?: any): Chromeless<T> {
    this.queue.enqueue({ type: 'press', keyCode, count, modifiers })

    return this
  }

  type(input: string, selector?: string): Chromeless<T> {
    this.queue.enqueue({ type: 'type', input, selector })

    return this
  }

  back(): Chromeless<T> {
    throw new Error('Not implemented yet')
  }

  forward(): Chromeless<T> {
    throw new Error('Not implemented yet')
  }

  refresh(): Chromeless<T> {
    throw new Error('Not implemented yet')
  }

  mousedown(selector: string): Chromeless<T> {
    this.queue.enqueue({ type: 'mousedown', selector })
    return this
  }

  mouseup(selector: string): Chromeless<T> {
    this.queue.enqueue({ type: 'mouseup', selector })
    return this
  }

  mouseover(): Chromeless<T> {
    throw new Error('Not implemented yet')
  }

  scrollTo(x: number, y: number): Chromeless<T> {
    this.queue.enqueue({ type: 'scrollTo', x, y })

    return this
  }

  setViewport(options: DeviceMetrics): Chromeless<T> {
    this.queue.enqueue({ type: 'setViewport', options })

    return this
  }

  setHtml(html: string): Chromeless<T> {
    this.queue.enqueue({ type: 'setHtml', html })

    return this
  }

  evaluate<U extends any>(
    fn: (...args: any[]) => void,
    ...args: any[]
  ): Chromeless<U> {
    this.lastReturnPromise = this.queue.process<U>({
      type: 'returnCode',
      fn: fn.toString(),
      args,
    })

    return new Chromeless<U>({}, this)
  }

  inputValue(selector: string): Chromeless<string> {
    this.lastReturnPromise = this.queue.process<string>({
      type: 'returnInputValue',
      selector,
    })

    return new Chromeless<string>({}, this)
  }

  exists(selector: string): Chromeless<boolean> {
    this.lastReturnPromise = this.queue.process<boolean>({
      type: 'returnExists',
      selector,
    })

    return new Chromeless<boolean>({}, this)
  }

  screenshot(): Chromeless<string> {
    this.lastReturnPromise = this.queue.process<string>({
      type: 'returnScreenshot',
    })

    return new Chromeless<string>({}, this)
  }

  html(): Chromeless<string> {
    this.lastReturnPromise = this.queue.process<string>({ type: 'returnHtml' })

    return new Chromeless<string>({}, this)
  }

  pdf(options?: PdfOptions): Chromeless<string> {
    this.lastReturnPromise = this.queue.process<string>({
      type: 'returnPdf',
      options,
    })

    return new Chromeless<string>({}, this)
  }

  /**
   * Get the cookies for the current url
   */
  cookiesGet(): Chromeless<Cookie[] | null>
  /**
   * Get a specific cookie for the current url
   * @param name
   */
  cookiesGet(name: string): Chromeless<Cookie | null>
  /**
   * Get a specific cookie by query. Not implemented yet
   * @param query
   */
  cookiesGet(query: CookieQuery): Chromeless<Cookie[] | null>
  cookiesGet(
    nameOrQuery?: string | CookieQuery,
  ): Chromeless<Cookie | Cookie[] | null> {
    if (typeof nameOrQuery !== 'undefined') {
      throw new Error('Querying cookies is not implemented yet')
    }

    this.lastReturnPromise = this.queue.process<Cookie[] | Cookie | null>({
      type: 'cookiesGet',
      nameOrQuery,
    })

    return new Chromeless<Cookie | Cookie[] | null>({}, this)
  }

  cookiesGetAll(): Chromeless<Cookie[]> {
    this.lastReturnPromise = this.queue.process<Cookie[]>({
      type: 'cookiesGetAll',
    })

    return new Chromeless<Cookie[]>({}, this)
  }

  cookiesSet(name: string, value: string): Chromeless<T>
  cookiesSet(cookie: Cookie): Chromeless<T>
  cookiesSet(cookies: Cookie[]): Chromeless<T>
  cookiesSet(nameOrCookies, value?: string): Chromeless<T> {
    this.queue.enqueue({ type: 'cookiesSet', nameOrCookies, value })

    return this
  }

  deleteCookies(name: string, url: string): Chromeless<T> {
    if (typeof name === 'undefined') {
      throw new Error('Cookie name should be defined.')
    }
    if (typeof url === 'undefined') {
      throw new Error('Cookie url should be defined.')
    }
    this.queue.enqueue({type: 'deleteCookies', name, url})

    return this
  }

  clearCookies(): Chromeless<T> {
    this.queue.enqueue({type: 'clearCookies'})

    return this
  }

    clearInput(selector: string): Chromeless<T> {
    this.queue.enqueue({type: 'clearInput', selector})
    return this
  }

  async end(): Promise<T> {
    const result = await this.lastReturnPromise
    await this.queue.end()
    return result
  }
}
