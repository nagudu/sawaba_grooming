import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env'
import { sequelize, connectDatabase } from './config/database'
import { apiRouter } from './routes'
import { swaggerSpec } from './swagger'
import { apiLimiter } from './middleware/rateLimiter'
import { notFoundHandler, errorHandler } from './middleware/errorHandler'

// Eagerly load all models and associations before starting.
import './models'

const app: Express = express()

app.use(helmet())

app.use(
  cors({
    origin: [env.clientUrl, ...env.extraClientOrigins],
    credentials: true,
  }),
)

app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

// Paystack webhook: must read the RAW body to validate the x-paystack-signature HMAC.
// Mounted BEFORE express.json so the raw stream is captured first (body-parser marks
// req._body afterwards, so the JSON parser below skips this route automatically).
app.use(
  '/api/payments/paystack/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
)
app.use((req, _res, next) => {
  if (req.path === '/api/payments/paystack/webhook' && Buffer.isBuffer(req.body)) {
    ;(req as Request & { rawBody?: string }).rawBody = (req.body as Buffer).toString('utf8')
  }
  next()
})

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api', apiLimiter)

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SAWABA API Docs',
}))

app.get('/api/docs/spec', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

app.use('/api', apiRouter)

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(notFoundHandler)
app.use(errorHandler)

async function startServer(): Promise<void> {
  try {
    await connectDatabase()
    console.log('[server] database connection established')

    // Static frontend serving (production single-service deploy). Activated
    // only when SERVE_STATIC_DIR points at a built frontend (e.g. ../dist).
    // Local dev never sets it, so behavior is unchanged.
    const staticDir = process.env.SERVE_STATIC_DIR
    if (staticDir) {
      const path = await import('node:path')
      const fs = await import('node:fs')
      const resolved = path.resolve(staticDir)
      if (fs.existsSync(path.join(resolved, 'index.html'))) {
        app.use(express.static(resolved))
        // SPA fallback: any non-API GET serves index.html so /admin/*,
        // /pay/:token, /account/* survive refresh and direct navigation.
        app.get('*', (req: Request, res: Response, next: NextFunction) => {
          if (req.path.startsWith('/api/') || req.path === '/health') return next()
          res.sendFile(path.join(resolved, 'index.html'))
        })
        console.log(`[server] serving static frontend from ${resolved}`)
      } else {
        console.warn(`[server] SERVE_STATIC_DIR set but no index.html at ${resolved}`)
      }
    }

    // Use { force: false, alter: process.env.NODE_ENV === 'development' } on first start via db:sync instead.
    await sequelize.sync({ force: false })
    console.log('[server] models synchronized')

    app.listen(env.port, () => {
      console.log(`[server] running on http://localhost:${env.port}`)
      console.log(`[server] swagger docs: http://localhost:${env.port}/api/docs`)
    })
  } catch (error) {
    console.error('[server] failed to start:', error)
    process.exit(1)
  }
}

void startServer()