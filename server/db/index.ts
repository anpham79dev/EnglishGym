import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const createDb = () =>
    drizzle(
        createClient({
            url: process.env.DATABASE_URL || 'file:./data/local.db',
            authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
        }),
        { schema },
    )

export type Db = ReturnType<typeof createDb>
/** Kiểu của `tx` trong db.transaction(), dùng chung cho service. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

let _db: Db | undefined

export const useDb = (): Db => (_db ??= createDb())

export { schema }
