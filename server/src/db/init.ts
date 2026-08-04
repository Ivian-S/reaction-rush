import mysql from 'mysql2/promise'
import { config } from '../config/env.js'
import { pool } from './pool.js'

const CREATE_DATABASE_SQL = `
CREATE DATABASE IF NOT EXISTS \`${config.db.database}\`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci
`

const CREATE_PLAYERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS players (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nickname VARCHAR(12) NOT NULL COMMENT 'Display nickname',
  nickname_key VARCHAR(12) NOT NULL COMMENT 'Normalized lowercase key',
  best_avg_session_id BIGINT UNSIGNED NULL COMMENT 'Reference to best average session',
  fastest_session_id BIGINT UNSIGNED NULL COMMENT 'Reference to fastest single round session',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_nickname_key (nickname_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_SESSIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS test_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_session_id VARCHAR(64) NOT NULL COMMENT 'Client-generated unique session ID',
  player_id BIGINT UNSIGNED NOT NULL COMMENT 'Reference to player',
  avg_reaction_ms INT UNSIGNED NULL COMMENT 'Average reaction time in ms (rounded)',
  fastest_reaction_ms INT UNSIGNED NULL COMMENT 'Fastest single round in ms',
  slowest_reaction_ms INT UNSIGNED NULL COMMENT 'Slowest valid round in ms',
  valid_count TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of valid rounds (max 5)',
  early_count TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of early clicks',
  timeout_count TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of timeouts',
  abnormal_count TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of abnormal (<50ms) clicks',
  completed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_best_avg TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this is player best average',
  is_fastest TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this has player fastest single round',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_client_session_id (client_session_id),
  KEY idx_player_id (player_id),
  CONSTRAINT fk_sessions_player FOREIGN KEY (player_id) REFERENCES players(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_ROUNDS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS test_rounds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL COMMENT 'Reference to test session',
  round_number TINYINT UNSIGNED NOT NULL COMMENT 'Round number 1-5',
  result ENUM('success', 'early', 'timeout', 'abnormal') NOT NULL COMMENT 'Round result',
  reaction_ms INT UNSIGNED NULL COMMENT 'Reaction time in ms, NULL for non-success',
  wait_duration_ms INT UNSIGNED NOT NULL COMMENT 'Random wait duration before green',
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_session_round (session_id, round_number),
  KEY idx_session_id (session_id),
  CONSTRAINT fk_rounds_session FOREIGN KEY (session_id) REFERENCES test_sessions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

export async function initDatabase(): Promise<void> {
  const tempPool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    charset: 'utf8mb4'
  })

  try {
    await tempPool.execute(CREATE_DATABASE_SQL)
    console.log('[DB] Database ready:', config.db.database)
  } finally {
    await tempPool.end()
  }

  await pool.execute(CREATE_PLAYERS_TABLE_SQL)
  console.log('[DB] Table ready: players')

  await pool.execute(CREATE_SESSIONS_TABLE_SQL)
  console.log('[DB] Table ready: test_sessions')

  await pool.execute(CREATE_ROUNDS_TABLE_SQL)
  console.log('[DB] Table ready: test_rounds')

  console.log('[DB] Database initialization complete')
}