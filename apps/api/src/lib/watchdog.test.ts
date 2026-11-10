import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findProblems, readSnapshot, startWatchdog, type ServerSnapshot } from './watchdog.js'

const HOUR = 60 * 60 * 1_000
const now = new Date('2026-11-10T06:00:00Z')
const hoursAgo = (h: number) => ({ at: new Date(now.getTime() - h * HOUR) })
const GB = 1024 ** 3
const roomyDisk = { freeBytes: 40 * GB, totalBytes: 100 * GB }
/** Started long ago, so missing status files count. */
const options = { now, upSince: new Date(now.getTime() - 100 * HOUR), diskAlertPercent: 15 }
const healthy: NonNullable<ServerSnapshot['status']> = { backupOk: hoursAgo(4), offsiteOk: hoursAgo(3) }
const keys = (snapshot: ServerSnapshot, opts = options) => findProblems(snapshot, opts).map((p) => p.key)

describe('watchdog: what counts as a problem', () => {
  it('is quiet on a healthy server', () => {
    expect(keys({ disk: roomyDisk, status: healthy })).toEqual([])
  })

  it('warns when free disk drops below the threshold, and says how full', () => {
    const [problem] = findProblems({ disk: { freeBytes: 9 * GB, totalBytes: 100 * GB }, status: healthy }, options)
    expect(problem?.key).toBe('disk')
    expect(problem?.subject).toBe('Server disk is 91% full')
    expect(problem?.body[0]).toContain('9.0 GB of 100.0 GB')
  })

  it('reports a failed backup with its error, until a later one succeeds', () => {
    const failed = { ...healthy, backupFailed: { ...hoursAgo(2), message: 'connection refused' } }
    const [problem] = findProblems({ disk: roomyDisk, status: failed }, options)
    expect(problem?.key).toBe('backup-failed')
    expect(problem?.body[0]).toContain('connection refused')

    expect(keys({ disk: roomyDisk, status: { ...failed, backupOk: hoursAgo(1) } })).toEqual([])
  })

  it('reports a backup that has not run for over a day', () => {
    expect(keys({ disk: roomyDisk, status: { ...healthy, backupOk: hoursAgo(27) } })).toEqual(['backup-stale'])
    expect(keys({ disk: roomyDisk, status: { ...healthy, backupOk: hoursAgo(25) } })).toEqual([])
  })

  it('gives a freshly started server a day before missing backups count', () => {
    const fresh = { ...options, upSince: new Date(now.getTime() - 2 * HOUR) }
    expect(keys({ disk: roomyDisk, status: {} }, fresh)).toEqual([])
    expect(keys({ disk: roomyDisk, status: {} })).toEqual(['backup-stale', 'offsite-stale'])
  })

  it('reports off-site copies that failed or stopped', () => {
    expect(keys({ disk: roomyDisk, status: { ...healthy, offsiteFailed: hoursAgo(1) } })).toEqual(['offsite-failed'])
    expect(keys({ disk: roomyDisk, status: { ...healthy, offsiteOk: hoursAgo(51) } })).toEqual(['offsite-stale'])
  })

  it('does not email about off-site copies that are simply not set up', () => {
    expect(keys({ disk: roomyDisk, status: { backupOk: hoursAgo(4), offsiteOff: hoursAgo(1) } })).toEqual([])
    // Set up later: the newer success wins.
    expect(keys({ disk: roomyDisk, status: { ...healthy, offsiteOff: hoursAgo(90) } })).toEqual([])
  })

  it('skips the backup checks where no status directory is configured', () => {
    expect(keys({ disk: roomyDisk, status: null })).toEqual([])
  })
})

describe('watchdog: reading the status files', () => {
  let dir: string | undefined
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('reads the time and error the backup containers write', async () => {
    dir = await mkdtemp(join(tmpdir(), 'watchdog-'))
    await writeFile(join(dir, 'backup-ok'), '1762740000\n')
    await writeFile(join(dir, 'backup-failed'), '1762750000\npg_dump: error: connection\n  refused\n')
    const snapshot = await readSnapshot(dir)
    expect(snapshot.status?.backupOk?.at.toISOString()).toBe(new Date(1762740000 * 1_000).toISOString())
    expect(snapshot.status?.backupFailed?.message).toBe('pg_dump: error: connection refused')
    expect(snapshot.status?.offsiteOk).toBeUndefined()
    expect(snapshot.disk?.totalBytes).toBeGreaterThan(0)
  })
})

describe('watchdog: emails', () => {
  afterEach(() => vi.useRealTimers())

  it('emails a problem once, not on every check, and again once a day while it lasts', async () => {
    vi.useFakeTimers({ now, toFake: ['setInterval', 'Date'] })
    const dir = await mkdtemp(join(tmpdir(), 'watchdog-'))
    try {
      const failedAt = Math.floor(now.getTime() / 1_000) - 3_600
      await writeFile(join(dir, 'backup-failed'), `${failedAt}\ndisk full\n`)
      await writeFile(join(dir, 'offsite-off'), `${failedAt}\n`)
      const alert = vi.fn(async () => {})
      const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const timer = startWatchdog({ minutes: 30, statusDir: dir, diskAlertPercent: 0.0001, log, alert })

      await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(1))
      expect(alert).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Last night’s database backup failed' }))
      expect(log.warn).toHaveBeenCalledWith({}, expect.stringContaining('OFF-SITE BACKUPS NOT CONFIGURED'))

      await vi.advanceTimersByTimeAsync(2 * HOUR)
      expect(alert).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(23 * HOUR)
      await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(2))
      expect(log.warn).toHaveBeenCalledTimes(1)
      clearInterval(timer)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
