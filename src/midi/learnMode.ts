import { midiApi } from './api';

export interface LearnState {
  paramKey: string | null;
  isEngineParam: boolean;
  active: boolean;
}

class LearnModeManager {
  private state: LearnState = {
    paramKey: null,
    isEngineParam: false,
    active: false,
  };
  private onStateChangeCallbacks: Set<(state: LearnState) => void> = new Set();
  private onLearnSuccessCallbacks: Set<
    (
      paramKey: string,
      isEngineParam: boolean,
      ccNumber: number,
      controllerId: string,
    ) => void
  > = new Set();
  private unsubscribeMidi: (() => void) | null = null;

  startLearn(paramKey: string, isEngineParam = false): void {
    this.state = {
      paramKey,
      isEngineParam,
      active: true,
    };
    this.notifyState();

    // Dynamically listen to MIDI inputs when learn mode triggers
    if (!this.unsubscribeMidi) {
      this.unsubscribeMidi = midiApi.subscribeInput((event, deviceId) => {
        if (event.type === 'cc' && this.state.active && this.state.paramKey) {
          const ccNumber = event.number;

          // Trigger success callbacks
          this.onLearnSuccessCallbacks.forEach((cb) =>
            cb(
              this.state.paramKey!,
              this.state.isEngineParam,
              ccNumber,
              deviceId,
            ),
          );

          // Reset learning state
          this.cancelLearn();
        }
      });
    }
  }

  cancelLearn(): void {
    this.state = {
      paramKey: null,
      isEngineParam: false,
      active: false,
    };
    this.notifyState();

    if (this.unsubscribeMidi) {
      this.unsubscribeMidi();
      this.unsubscribeMidi = null;
    }
  }

  getState(): LearnState {
    return { ...this.state };
  }

  subscribeState(callback: (state: LearnState) => void): () => void {
    this.onStateChangeCallbacks.add(callback);
    return () => {
      this.onStateChangeCallbacks.delete(callback);
    };
  }

  subscribeLearnSuccess(
    callback: (
      paramKey: string,
      isEngineParam: boolean,
      ccNumber: number,
      controllerId: string,
    ) => void,
  ): () => void {
    this.onLearnSuccessCallbacks.add(callback);
    return () => {
      this.onLearnSuccessCallbacks.delete(callback);
    };
  }

  private notifyState() {
    this.onStateChangeCallbacks.forEach((cb) => cb({ ...this.state }));
  }
}

export const midiLearn = new LearnModeManager();
