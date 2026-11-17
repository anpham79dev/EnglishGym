import { importAll } from '../services/backupService'

export default defineEventHandler(async (event) => importAll(await readBody(event)))
