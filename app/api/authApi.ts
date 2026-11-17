export interface Me {
    id: string
    email: string
}

export const fetchMe = () => $fetch<{ user: Me | null }>('/api/auth/me')

export const login = (email: string, password: string) =>
    $fetch<Me>('/api/auth/login', { method: 'POST', body: { email, password } })

export const logout = () => $fetch('/api/auth/logout', { method: 'POST' })
