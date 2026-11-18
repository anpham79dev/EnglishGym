/**
 * Create review cards (N5) for mistake hits confirmed before cards existed. Safe to re-run:
 * hits that already have a card are skipped.
 *   npm run db:backfill-cards
 */
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const { useDb, schema } = await import('../server/db')
const { createCardsForHits, rebalanceCards } = await import('../server/services/cardService')
const { isNull, eq } = await import('drizzle-orm')

const db = useDb()
const missing = await db
    .select({ id: schema.mistakeHits.id })
    .from(schema.mistakeHits)
    .leftJoin(schema.cards, eq(schema.cards.hitId, schema.mistakeHits.id))
    .where(isNull(schema.cards.id))
await db.transaction(async (tx) => {
    await createCardsForHits(
        tx,
        missing.map((r) => r.id),
    )
    for (const { id } of await tx.select({ id: schema.mistakes.id }).from(schema.mistakes))
        await rebalanceCards(tx, id)
})
console.log(`Đã tạo ${missing.length} thẻ ôn.`)
