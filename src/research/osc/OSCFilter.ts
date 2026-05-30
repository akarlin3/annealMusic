export interface FilterRule {
  address: string;
  enabled: boolean;
  throttleMs: number; // 0 means immediate (no rate-limit)
}

const STORAGE_KEY = 'anneal_osc_filter_rules';

// Default configuration for rate limits and enabling/disabling
export const DEFAULT_RULES: FilterRule[] = [
  { address: '/anneal/state/root', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/spread', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/density', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/coupling', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/drift', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/brightness', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/space', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/volume', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/engine', enabled: true, throttleMs: 0 },
  { address: '/anneal/state/mode', enabled: true, throttleMs: 0 },
  { address: '/anneal/spectrum', enabled: true, throttleMs: 33 }, // ~30Hz default
  { address: '/anneal/partials', enabled: true, throttleMs: 33 }, // ~30Hz default
  { address: '/anneal/session/state', enabled: true, throttleMs: 0 },
  { address: '/anneal/session/elapsed', enabled: true, throttleMs: 100 }, // 10Hz default
];

export class OSCFilter {
  private rules: Map<string, FilterRule> = new Map();
  private lastSent: Map<string, number> = new Map();

  constructor() {
    this.loadRules();
  }

  private loadRules(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as FilterRule[];
        parsed.forEach((r) => this.rules.set(r.address, r));
      } else {
        this.resetToDefaults();
      }
    } catch {
      this.resetToDefaults();
    }
  }

  saveRules(): void {
    try {
      const array = Array.from(this.rules.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
    } catch (e) {
      console.error('Failed to save OSC filter rules', e);
    }
  }

  resetToDefaults(): void {
    this.rules.clear();
    DEFAULT_RULES.forEach((rule) => {
      this.rules.set(rule.address, { ...rule });
    });
    this.saveRules();
  }

  getRules(): FilterRule[] {
    return Array.from(this.rules.values());
  }

  getRule(address: string): FilterRule {
    // Dynamic matching for engine-specific params e.g. /anneal/state/engine_params/fm/modRatio
    if (!this.rules.has(address)) {
      const isEngineParam = address.startsWith('/anneal/state/engine_params/');
      const defaultRule: FilterRule = {
        address,
        enabled: true,
        throttleMs: isEngineParam ? 0 : 0, // engine params map immediately by default
      };
      this.rules.set(address, defaultRule);
      this.saveRules();
    }
    return this.rules.get(address)!;
  }

  updateRule(
    address: string,
    patch: Partial<Omit<FilterRule, 'address'>>,
  ): void {
    const rule = this.getRule(address);
    const updated = { ...rule, ...patch };
    this.rules.set(address, updated);
    this.saveRules();
  }

  /**
   * Evaluates if a message passes the active whitelist and rate limits.
   * Updates last transmission time if verified.
   */
  shouldPass(address: string): boolean {
    const rule = this.getRule(address);
    if (!rule.enabled) return false;

    if (rule.throttleMs <= 0) return true;

    const now = Date.now();
    const last = this.lastSent.get(address) ?? 0;

    if (now - last >= rule.throttleMs) {
      this.lastSent.set(address, now);
      return true;
    }

    return false;
  }

  /**
   * Resets the throttling timer. Useful when starting a new session.
   */
  clearTimers(): void {
    this.lastSent.clear();
  }
}
