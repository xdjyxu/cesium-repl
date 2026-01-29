import type { InjectionKey } from 'vue'

/**
 * 依赖注入元数据
 */
interface AutowiredMetadata {
  propertyKey: string | symbol
  serviceKey: InjectionKey<any>
}

/**
 * 存储类的依赖注入元数据
 */
const autowiredMetadataMap = new WeakMap<any, AutowiredMetadata[]>()

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
 * 自动注入服务实例的依赖
 * 读取通过 @Autowired 装饰器标记的属性，并自动注入对应的服务
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
 * 创建 useService 组合式函数的工厂
 *
 * @param serviceKey - 服务的注入键
 * @param options - 配置选项
 * @param options.autoDependencies - 是否自动注入服务的依赖（通过 @Autowired 装饰器标记的属性）
 * @returns useService 组合式函数
 *
 * @example
 * ```typescript
 * export const useProfileService = createUseService(ProfileService, { autoDependencies: true })
 * ```
 */
export function createUseService<T>(
  serviceKey: InjectionKey<T>,
  options?: { autoDependencies?: boolean },
) {
  return (): T => {
    const service = inject(serviceKey)
    if (!service) {
      const serviceName = String(serviceKey.description || serviceKey)
      throw new Error(`${serviceName} has not been provided`)
    }

    if (options?.autoDependencies) {
      injectDependencies(service)
    }

    return service
  }
}

/**
 * 创建 provideService 函数的工厂
 *
 * @param serviceKey - 服务的注入键
 * @param ServiceImpl - 服务实现类
 * @returns provideService 函数
 *
 * @example
 * ```typescript
 * export const provideProfileService = createProvideService(ProfileService, ProfileServiceImpl)
 * ```
 */
export function createProvideService<T, Args extends any[]>(
  serviceKey: InjectionKey<T>,
  ServiceImpl: new (...args: Args) => T,
) {
  return (...args: Args): void => {
    const service = new ServiceImpl(...args)
    provide(serviceKey, service)
  }
}
