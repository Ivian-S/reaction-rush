import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config/env.js'
import { initDatabase } from './db/init.js'
import healthRouter from './routes/health.js'
import playersRouter from './routes/players.js'
import sessionsRouter from './routes/sessions.js'
import leaderboardRouter from './routes/leaderboard.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.resolve(__dirname, '../../frontend/dist')

const app = express()

app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}))

app.use(express.json())

app.use('/api', healthRouter)
app.use('/api/players', playersRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/leaderboard', leaderboardRouter)

app.use(express.static(distPath))

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

async function bootstrap() {
  try {
    await initDatabase()
  } catch (error) {
    console.error('[DB] Database initialization failed:', error)
    console.error('[DB] Server will start without database support')
  }

  app.listen(config.port, () => {
    console.log(`[Server] Reaction Rush server running at http://localhost:${config.port}`)
  })
}

bootstrap().catch((error) => {
  console.error('[Server] Failed to start:', error)
  process.exit(1)
})