import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>
const KEY_LEN = 64

export const hashPassword = async (password: string) => {
    const salt = randomBytes(16)
    const key = await scrypt(password, salt, KEY_LEN)
    return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export const verifyPassword = async (password: string, stored: string) => {
    const [algo, saltHex, keyHex] = stored.split('$')
    if (algo !== 'scrypt' || !saltHex || !keyHex) return false
    const expected = Buffer.from(keyHex, 'hex')
    const key = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)
    return timingSafeEqual(key, expected)
}
