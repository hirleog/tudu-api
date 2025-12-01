// notification-lock.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationLockService {
  private locks = new Map<string, Promise<any>>();

  async acquireLock(key: string, timeoutMs = 10000): Promise<() => void> {
    const lockKey = `notification:${key}`;

    // Se já existe um lock, aguarda
    while (this.locks.has(lockKey)) {
      await this.locks.get(lockKey);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Cria um novo lock
    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    this.locks.set(lockKey, lockPromise);

    // Timeout automático
    setTimeout(() => {
      this.releaseLock(key);
    }, timeoutMs);

    return () => this.releaseLock(key);
  }

  private releaseLock(key: string): void {
    const lockKey = `notification:${key}`;
    const lock = this.locks.get(lockKey);
    if (lock) {
      this.locks.delete(lockKey);
    }
  }
}
