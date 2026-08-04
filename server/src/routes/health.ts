import { Router } from 'express'
import { testConnection } from '../db/pool.js'

const router = Router()

router.get('/health', async (_req, res) => {
  try {
    const dbConnected = await testConnection()
    res.json({
      success: true,
      service: 'reaction-rush-server',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    })
  } catch {
    res.json({
      success: true,
      service: 'reaction-rush-server',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    })
  }
})

export default router