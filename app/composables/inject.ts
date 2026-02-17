import type { InjectionKey } from 'vue'
import { inject } from 'vue'

/**
 * 生命周期阶段常量
 */
export const LifecyclePhases = {
  PostConstruct: 'postConstruct',
  PostInject: 'postInject',
} as const

/**
 * 生命周期阶段类型
 */
export type LifecyclePhase = typeof LifecyclePhases[keyof typeof LifecyclePhases]

/**
 * 依赖注入元数据
 */
interface AutowiredMetadata {
  propertyKey: string | symbol
  serviceKey: InjectionKey<any>
}

/**
 * 生命周期方法元数据
 */
interface LifecycleMetadata {
  methodName: string | symbol
  phase: LifecyclePhase
}

/**
 * 存储类的依赖注入元数据
 */
const autowiredMetadataMap = new WeakMap<any, AutowiredMetadata[]>()

/**
 * 存储类的生命周期方法元数据
 */
const lifecycleMetadataMap = new WeakMap<any, LifecycleMetadata[]>()

/**
 * 自动装配装饰器
 * 标记需要自动注入的服务依赖
 *
 * @example
 * ```typescript
 * class ProfileServiceImpl implements ProfileService {
 *   @Autowired(StoreService)
 *   private storeService!: StoreService
 * }
 * ```
 */
export function Autowired(serviceKey: InjectionKey<any>) {
  return function (_target: undefined, context: ClassFieldDecoratorContext) {
    const propertyKey = context.name

    context.addInitializer(function (this: any) {
      const constructor = this.constructor
      const metadata = autowiredMetadataMap.get(constructor) || []
      metadata.push({ propertyKey, serviceKey })
      autowiredMetadataMap.set(constructor, metadata)
    })
  }
}

/**
 * PostConstruct 装饰器
 * 标记在实例化后需要执行的方法（在依赖注入前执行）
 * 支持同步和异步方法
 *
 * @example
 * ```typescript
 * class ServiceImpl implements Service {
 *   @PostConstruct
 *   private initialize(): void {
 *     // 在实例化后、依赖注入前自动执行
 *     // 此时 @Autowired 的依赖还未注入
 *   }
 * }
 * ```
 */
export function PostConstruct(_target: any, context: ClassMethodDecoratorContext) {
  const methodName = context.name

  context.addInitializer(function (this: any) {
    const constructor = this.constructor
    const metadata = lifecycleMetadataMap.get(constructor) || []
    metadata.push({ methodName, phase: LifecyclePhases.PostConstruct })
    lifecycleMetadataMap.set(constructor, metadata)
  })
}

/**
 * PostInject 装饰器
 * 标记在依赖注入后需要执行的方法
 * 支持同步和异步方法
 *
 * @example
 * ```typescript
 * class EditorServiceImpl implements EditorService {
 *   @Autowired(MonacoLoaderService)
 *   private monacoLoader!: MonacoLoaderService
 *
 *   @PostInject
 *   private async initialize(): Promise<void> {
 *     // 在依赖注入后自动执行
 *     // 此时可以安全访问 this.monacoLoader
 *     await this.monacoLoader.getMonaco()
 *   }
 * }
 * ```
 */
export function PostInject(_target: any, context: ClassMethodDecoratorContext) {
  const methodName = context.name

  context.addInitializer(function (this: any) {
    const constructor = this.constructor
    const metadata = lifecycleMetadataMap.get(constructor) || []
    metadata.push({ methodName, phase: LifecyclePhases.PostInject })
    lifecycleMetadataMap.set(constructor, metadata)
  })
}

/**
 * 自动注入服务实例的依赖
 * 读取通过 @Autowired 装饰器标记的属性，并自动注入对应的服务
 * 必须在 Vue setup 上下文中调用（即 inject() 可用时）
 *
 * @param instance - 服务实例
 */
export function injectDependencies(instance: any): void {
  const metadata = autowiredMetadataMap.get(instance.constructor)
  if (!metadata) {
    return
  }

  for (const { propertyKey, serviceKey } of metadata) {
    const service = inject(serviceKey)
    if (!service) {
      console.warn(`Failed to inject ${String(propertyKey)}: service not provided`)
      continue
    }
    instance[propertyKey] = service
  }
}

/**
 * 执行生命周期方法
 * 读取通过生命周期装饰器标记的方法并执行（支持异步方法）
 *
 * @param instance - 服务实例
 * @param phase - 生命周期阶段
 * @returns Promise，在所有生命周期方法执行完成后 resolve
 */
export async function executeLifecycleMethods(instance: any, phase: LifecyclePhase): Promise<void> {
  const metadata = lifecycleMetadataMap.get(instance.constructor)
  if (!metadata) {
    return
  }

  const methods = metadata.filter(m => m.phase === phase)
  const promises: Promise<any>[] = []

  for (const { methodName } of methods) {
    const method = instance[methodName]
    if (typeof method === 'function') {
      const result = method.call(instance)
      // 如果方法返回 Promise，收集起来等待
      if (result instanceof Promise) {
        promises.push(result)
      }
    }
    else {
      console.warn(`Lifecycle method ${String(methodName)} is not a function`)
    }
  }

  // 等待所有异步生命周期方法完成
  await Promise.all(promises)
}

/**
 * 创建 useService 组合式函数的工厂
 *
 * @param serviceKey - 服务的注入键
 * @returns useService 组合式函数
 *
 * @example
 * ```typescript
 * export const useProfileService = createUseService(ProfileService)
 * ```
 */
export function createUseService<T>(
  serviceKey: InjectionKey<T>,
) {
  return (): T => {
    const service = inject(serviceKey)
    if (!service) {
      const serviceName = String(serviceKey.description || serviceKey)
      throw new Error(`${serviceName} has not been provided`)
    }

    // 在 setup 上下文中注入依赖
    injectDependencies(service)

    // 执行 PostInject 生命周期方法（异步但不等待）
    void executeLifecycleMethods(service, LifecyclePhases.PostInject)

    return service
  }
}

/**
 * 具有 provide 方法的对象约束
 * 比 Vue App 更宽松，只要求对象能提供依赖注入即可
 */
interface Providable {
  provide: (key: InjectionKey<unknown> | string, value: unknown) => unknown
}

/**
 * 创建 Nuxt 插件级别的服务注册函数工厂
 * 适用于任何具有 provide 方法的上下文（如 nuxtApp.vueApp）
 *
 * @param serviceKey - 服务的注入键
 * @param ServiceImpl - 服务实现类
 * @param options - 配置选项
 * @param options.executeLifecycle - 是否执行 PostConstruct 生命周期方法
 * @returns 接受 Providable 对象的注册函数
 *
 * @example
 * ```typescript
 * // browser/storeService/useStoreService.ts
 * export const registerStoreService = createPluginService(StoreService, StoreServiceImpl)
 *
 * // plugins/services.client.ts
 * export default defineNuxtPlugin((nuxtApp) => {
 *   registerStoreService(nuxtApp.vueApp)
 * })
 * ```
 */
export function createPluginService<T>(
  serviceKey: InjectionKey<T>,
  ServiceImpl: new () => T,
  options?: { executeLifecycle?: boolean },
) {
  return (app: Providable): void => {
    const service = new ServiceImpl()

    if (options?.executeLifecycle) {
      void executeLifecycleMethods(service, LifecyclePhases.PostConstruct)
    }

    app.provide(serviceKey, service)
  }
}
