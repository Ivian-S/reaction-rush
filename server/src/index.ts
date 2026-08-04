import express from 'express'
import cors from 'cors'
import { config } from './config/env.js'
import { initDatabase } from './db/init.js'
import healthRouter from './routes/health.js'
import playersRouter from './routes/players.js'
import sessionsRouter from './routes/sessions.js'
import leaderboardRouter from './routes/leaderboard.js'

const allowedOrigins = new Set(
  config.corsOrigins
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
)

const app = express()

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`Origin not allowed: ${origin}`))
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}))

app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    service: 'reaction-rush-server',
    version: '1.0.0',
    docs: '/api/health'
  })
})

app.use('/api', healthRouter)
app.use('/api/players', playersRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/leaderboard', leaderboardRouter)

async function bootstrap() {
  try {
    await initDatabase()
  } catch (error) {
    console.error('[DB] Database initialization failed:', error)
    console.error('[DB] Server will start without database support')
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Server] Reaction Rush server running on port ${config.port}`)
  })
}

bootstrap().catch((error) => {
  console.error('[Server] Failed to start:', error)
  process.exit(1)
})