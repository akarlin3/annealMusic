/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Orchestrator } from '@/audio/orchestrator';
import { PiecePlayer } from '@/piece/PiecePlayer';
import {
  ListeningSessionPlayer,
  type ListeningSessionConfig,
} from '@/listening/ListeningSessionPlayer';
import { SonificationPlayer } from '@/sonification/SonificationPlayer';
import type { MappingSpec } from '@/sonification/types';

export type SessionPlayerMode =
  | 'piece'
  | 'listening'
  | 'sonification'
  | 'drone';

export class SessionPlayer {
  private mode: SessionPlayerMode;
  private orchestrator: Orchestrator;

  // Legacy delegate players
  private piecePlayer?: PiecePlayer;
  private listeningPlayer?: ListeningSessionPlayer;
  private sonificationPlayer?: SonificationPlayer;

  private isPlaying = false;
  private elapsedMs = 0;

  constructor(
    mode: SessionPlayerMode,
    orchestrator: Orchestrator,
    config: {
      piece?: any;
      listeningConfig?: ListeningSessionConfig;
      sonificationSpec?: MappingSpec;
      durationMs?: number;
      playbackSpeed?: number;
      loop?: boolean;
    },
  ) {
    this.mode = mode;
    this.orchestrator = orchestrator;

    if (mode === 'piece' && config.piece) {
      this.piecePlayer = new PiecePlayer(config.piece, orchestrator);
    } else if (mode === 'listening' && config.listeningConfig) {
      this.listeningPlayer = new ListeningSessionPlayer(
        config.listeningConfig,
        orchestrator,
      );
    } else if (mode === 'sonification' && config.sonificationSpec) {
      this.sonificationPlayer = new SonificationPlayer(
        config.sonificationSpec,
        config.durationMs ?? 15000,
        config.playbackSpeed ?? 1.0,
        config.loop ?? true,
      );
    }
  }

  start(
    onProgress?: (progress: number, elapsedOrRemaining: number) => void,
    onEnded?: () => void,
  ): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.piecePlayer) {
      this.piecePlayer.start((prog, idx) => onProgress?.(prog, idx), onEnded);
    } else if (this.listeningPlayer) {
      this.listeningPlayer.start(
        (prog, remaining) => onProgress?.(prog, remaining),
        onEnded,
      );
    } else if (this.sonificationPlayer) {
      this.sonificationPlayer.start(this.orchestrator, (elapsed) =>
        onProgress?.(elapsed / this.sonificationPlayer!.durationSec, elapsed),
      );
    }
  }

  pause(): void {
    this.isPlaying = false;
    this.piecePlayer?.pause();
    this.listeningPlayer?.pause();
    this.sonificationPlayer?.stop();
  }

  stop(): void {
    this.isPlaying = false;
    this.piecePlayer?.stop();
    this.listeningPlayer?.stop();
    this.sonificationPlayer?.stop();
    this.orchestrator.stop();
  }

  seek(timeMs: number): void {
    this.elapsedMs = timeMs;
    this.piecePlayer?.seek(timeMs);
    this.sonificationPlayer?.seek(timeMs / 1000, this.orchestrator);
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getMode(): SessionPlayerMode {
    return this.mode;
  }

  getElapsedMs(): number {
    if (this.piecePlayer) return this.piecePlayer.getPlayheadMs();
    if (this.listeningPlayer) return this.listeningPlayer.getElapsedMs();
    if (this.sonificationPlayer)
      return this.sonificationPlayer.getElapsed() * 1000;
    return this.elapsedMs;
  }
}
