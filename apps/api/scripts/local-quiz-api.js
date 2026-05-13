const http = require('http')
const { URL } = require('url')

const quizConfig = require('../.build/src/functions/quiz-config.js')
const quizResult = require('../.build/src/functions/quiz.js')

const port = Number(process.env.PORT || process.env.HTTP_PORT || '3001')
const host = process.env.HOST || '127.0.0.1'

function buildHeaders(source = {}) {
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    ...source,
  }
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

async function callHandler(handler, event) {
  const result = await handler(event)
  const statusCode = Number(result?.statusCode ?? 200)
  const headers = buildHeaders(result?.headers)
  const body = typeof result?.body === 'string' ? result.body : JSON.stringify(result?.body ?? {})

  return { statusCode, headers, body }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      res.writeHead(400, buildHeaders())
      res.end(JSON.stringify({ error: 'Invalid request.' }))
      return
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, buildHeaders({
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'Content-Type',
      }))
      res.end()
      return
    }

    if (req.method === 'GET' && url.pathname === '/quiz/config') {
      const result = await callHandler(quizConfig.handler, {
        queryStringParameters: Object.fromEntries(url.searchParams.entries()),
      })
      res.writeHead(result.statusCode, result.headers)
      res.end(result.body)
      return
    }

    if (req.method === 'POST' && (url.pathname === '/quiz/result' || url.pathname === '/quiz')) {
      const body = await collectBody(req)
      const result = await callHandler(quizResult.handler, {
        body,
      })
      res.writeHead(result.statusCode, result.headers)
      res.end(result.body)
      return
    }

    res.writeHead(404, buildHeaders())
    res.end(JSON.stringify({ error: 'Route not found.' }))
  } catch (error) {
    console.error('[local-quiz-api] request failed', error)
    res.writeHead(500, buildHeaders())
    res.end(JSON.stringify({ error: 'Local API failed to process the request.' }))
  }
})

server.listen(port, host, () => {
  console.log(`[local-quiz-api] listening on http://${host}:${port}`)
  console.log('[local-quiz-api] GET  /quiz/config?mode=quick|deep')
  console.log('[local-quiz-api] POST /quiz/result')
})
