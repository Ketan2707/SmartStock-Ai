import express from 'express'
import app from '../apps/api/src/app.js'

const handler = express()

handler.use('/api', app)
handler.use(app)

export default handler
