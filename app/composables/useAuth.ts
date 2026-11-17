import { fetchMe, login as apiLogin, logout as apiLogout, type Me } from '~/api/authApi'

export const useAuth = () => {
    const user = useState<Me | null | undefined>('auth-user', () => undefined)

    const refresh = async () => {
        try {
            user.value = (await fetchMe()).user
        } catch {
            user.value = null
        }
        return user.value
    }

    const login = async (email: string, password: string) => {
        user.value = await apiLogin(email, password)
    }

    const logout = async () => {
        await apiLogout()
        user.value = null
        await navigateTo('/login')
    }

    return { user, refresh, login, logout }
}
