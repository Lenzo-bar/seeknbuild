// api/server.js — local dev Express server
// Wraps all five Vercel serverless handlers so we can run without vercel dev.
// Usage: node api/server.js   (or via npm run api)

import express from 'express'
import { createServer } from 'http'

import searchHandler  from './search.js'
import llmHandler     from './llm.js'
import analyzeHandler from './analyze.js'
import solveHandler   from './solve.js'
import webonlyHandler from './webonly.js'

const app  = express()
const port = process.env.API_PORT || 3001

app.use(express.json({ limit: '50mb' }))

// Adapt a Vercel-style handler (req, res) to Express
function vercel(handler) {
  return (req, res) => handler(req, res)
}

app.all('/api/search',  vercel(searchHandler))
app.all('/api/llm',     vercel(llmHandler))
app.all('/api/analyze', vercel(analyzeHandler))
app.all('/api/solve',   vercel(solveHandler))
app.all('/api/webonly', vercel(webonlyHandler))

// Graceful handling of aborted connections — prevents ECONNRESET crashes
app.use((req, res, next) => {
  req.on('aborted', () => { /* swallow */ })
  next()
})

const server = createServer(app)

// Prevent the server from crashing on socket errors from aborted requests
server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    socket.destroy()
    return
  }
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})

server.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`)
})
