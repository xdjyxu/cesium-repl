import type { RollupDirectoryEntry, RollupFileStats, RollupFsModule } from '@rollup/browser'
import type { IStats, TFlagsCopy } from 'memfs/lib/node/types/misc'

import type { InjectionKey } from 'vue'

export type {
  IStats,
  RollupDirectoryEntry,
  RollupFileStats,
  TFlagsCopy,
}

export type FileService = RollupFsModule

// eslint-disable-next-line ts/no-redeclare
export const FileService = Symbol('FileService') as InjectionKey<FileService>
