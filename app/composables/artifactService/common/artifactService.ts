import type { SandcastleShareData } from '../../shareService/common/protocol'
import type { ArtifactService } from './protocol'
import { BehaviorSubject } from 'rxjs'

export class ArtifactServiceImpl implements ArtifactService {
  private _artifact$ = new BehaviorSubject<SandcastleShareData | null>(null)
  readonly artifact$ = this._artifact$

  setArtifact(data: SandcastleShareData | null): void {
    this._artifact$.next(data)
  }

  getArtifact(): SandcastleShareData | null {
    return this._artifact$.getValue()
  }
}
