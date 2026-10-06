import { getRegistrationStatus } from './api.js';

const SECOND = 1_000;
const SYNC_INTERVAL = 60_000;

export function calculateRemainingTime(deadline, serverTime, elapsedMilliseconds = 0) {
  const deadlineTime = new Date(deadline).getTime();
  const synchronizedTime = new Date(serverTime).getTime() + Math.max(0, elapsedMilliseconds);
  if (!Number.isFinite(deadlineTime) || !Number.isFinite(synchronizedTime)) return 0;
  return Math.max(0, deadlineTime - synchronizedTime);
}

export function splitRemainingTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / SECOND));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

export class RegistrationStatusManager {
  constructor({ fetchStatus = getRegistrationStatus, monotonicNow = () => performance.now() } = {}) {
    this.fetchStatus = fetchStatus;
    this.monotonicNow = monotonicNow;
    this.listeners = new Set();
    this.tickTimer = null;
    this.syncTimer = null;
    this.syncPromise = null;
    this.syncedAt = 0;
    this.zeroSyncRequested = false;
    this.state = {
      phase: 'loading', isOpen: null, deadline: null, serverTime: null,
      remainingTime: null, reason: null, message: null, error: null,
    };
    this.handleVisibility = () => { if (document.visibilityState === 'visible') this.sync().catch(() => {}); };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  start() {
    if (!this.syncTimer) this.syncTimer = setInterval(() => this.sync().catch(() => {}), SYNC_INTERVAL);
    document.addEventListener('visibilitychange', this.handleVisibility);
    return this.sync().catch(() => null);
  }

  async sync() {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.fetchStatus()
      .then((data) => {
        const remainingTime = calculateRemainingTime(data.deadline, data.server_time);
        this.syncedAt = this.monotonicNow();
        this.zeroSyncRequested = false;
        this.state = {
          phase: data.is_open ? 'open' : 'closed',
          isOpen: Boolean(data.is_open), deadline: data.deadline, serverTime: data.server_time,
          remainingTime, reason: data.reason || (data.is_open ? 'open' : 'deadline_passed'),
          message: data.message || (data.is_open ? null : 'Регистрация завершена.'), error: null,
        };
        if (this.state.isOpen && remainingTime > 0) this.startTicker();
        else this.stopTicker();
        this.notify();
        return { ...this.state };
      })
      .catch((error) => {
        this.state = { ...this.state, phase: 'error', error, message: 'Не удалось проверить статус регистрации.' };
        this.notify();
        throw error;
      })
      .finally(() => { this.syncPromise = null; });
    return this.syncPromise;
  }

  markClosed(message = 'Регистрация на хакатон уже завершена.') {
    this.stopTicker();
    this.state = { ...this.state, phase: 'closed', isOpen: false, remainingTime: 0, reason: 'backend_rejected', message, error: null };
    this.notify();
  }

  startTicker() {
    if (!this.tickTimer) this.tickTimer = setInterval(() => this.tick(), SECOND);
  }

  stopTicker() {
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  tick() {
    if (!this.state.deadline || !this.state.serverTime || this.state.isOpen !== true) return;
    const elapsed = this.monotonicNow() - this.syncedAt;
    const remainingTime = calculateRemainingTime(this.state.deadline, this.state.serverTime, elapsed);
    this.state = { ...this.state, remainingTime };
    this.notify();
    if (remainingTime === 0 && !this.zeroSyncRequested) {
      this.zeroSyncRequested = true;
      this.stopTicker();
      this.sync().catch(() => {});
    }
  }

  notify() { this.listeners.forEach((listener) => listener({ ...this.state })); }

  destroy() {
    this.stopTicker();
    clearInterval(this.syncTimer);
    this.syncTimer = null;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.listeners.clear();
  }
}

export const registrationStatus = new RegistrationStatusManager();
