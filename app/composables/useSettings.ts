/**
 * Per-device preferences (like LS_LAST_BACKUP): convenience only, never data that must sync.
 * Every storage access is guarded; private mode just falls back to the defaults.
 */
export interface AppSettings {
    /** N11: count manual self-study check-ins toward the streak. */
    streakIncludeCheckins: boolean
    /** N9: hide AI suggestions until you have marked suspected mistakes yourself. */
    selfFindFirst: boolean
    /** N9: start every AI issue unchecked, so each one must be kept on purpose. */
    noPrecheck: boolean
}

const KEY = 'eg:settings'
const DEFAULTS: AppSettings = {
    streakIncludeCheckins: true,
    selfFindFirst: true,
    noPrecheck: false,
}

const load = (): AppSettings => {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    } catch {
        return { ...DEFAULTS }
    }
}

export const useSettings = () => {
    const settings = useState<AppSettings>('settings', load)
    const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        settings.value = { ...settings.value, [key]: value }
        try {
            localStorage.setItem(KEY, JSON.stringify(settings.value))
        } catch {
            /* private mode: kept for this session only */
        }
    }
    return { settings, set }
}
