#!/usr/bin/env node
/**
 * Minimal CDP driver for verifying the DSH web GUI (headless Chromium on
 * --remote-debugging-port=9222). No external deps: Node's global fetch +
 * WebSocket.
 *
 * Usage:
 *   node cdp.mjs open <url> [waitMs]
 *   node cdp.mjs eval '<js expression>'          # returns JSON of the result
 *   node cdp.mjs evalraw '<js>'                  # returns JSON.stringify(result)
 *   node cdp.mjs shot <out.png>
 *   node cdp.mjs text [selector]                 # innerText of body (or selector)
 *   node cdp.mjs click <css-selector> [label]
 *   node cdp.mjs wait <ms>
 */
const CDP_PORT = process.env.CDP_PORT ?? '9222'
const BASE = `http://127.0.0.1:${CDP_PORT}`

async function pageTarget() {
  const list = await (await fetch(`${BASE}/json/list`)).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  return page
}

async function connect() {
  const target = await pageTarget()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) rej(new Error(msg.error.message))
      else res(msg.result)
    }
  }
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id
    pending.set(mid, { res, rej })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  return { ws, send }
}

async function evaluate(expression, { awaitPromise = true, returnByValue = true } = {}) {
  const { ws, send } = await connect()
  try {
    const result = await send('Runtime.evaluate', {
      expression, awaitPromise, returnByValue,
      userGesture: true,
    })
    if (result.exceptionDetails) {
      const ex = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text
      throw new Error(`eval failed: ${ex}`)
    }
    return result.result.value
  } finally { ws.close() }
}

async function screenshot(path) {
  const { ws, send } = await connect()
  try {
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(path, Buffer.from(shot.data, 'base64'))
    console.log(`saved ${path}`)
  } finally { ws.close() }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  switch (cmd) {
    case 'open': {
      const url = rest[0]
      const waitMs = Number(rest[1] ?? 6000)
      const { ws, send } = await connect()
      try {
        await send('Page.enable')
        await send('Runtime.enable')
        await send('Page.navigate', { url })
        await new Promise((r) => setTimeout(r, waitMs))
        console.log('navigated')
      } finally { ws.close() }
      break
    }
    case 'eval': {
      const out = await evaluate(rest[0])
      console.log(JSON.stringify(out))
      break
    }
    case 'evalraw': {
      const out = await evaluate(`(() => { try { return JSON.stringify(${rest.join(' ')}) } catch (e) { return 'ERR: ' + e.message } })()`)
      console.log(out)
      break
    }
    case 'shot': await screenshot(rest[0]); break
    case 'text': {
      const sel = rest[0]
      const expr = sel
        ? `document.querySelector(${JSON.stringify(sel)})?.innerText ?? '(not found)'`
        : `document.body?.innerText ?? ''`
      console.log(await evaluate(expr))
      break
    }
    case 'click': {
      const sel = rest[0]
      const out = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)})
        if (!el) return 'not found: ' + ${JSON.stringify(sel)}
        el.click()
        return 'clicked: ' + (el.tagName + '.' + (el.className ?? '').toString().slice(0, 40))
      })()`)
      console.log(out)
      break
    }
    case 'wait': await new Promise((r) => setTimeout(r, Number(rest[0] ?? 1000))); console.log('waited'); break
    default:
      console.error('unknown command', cmd)
      process.exit(1)
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
