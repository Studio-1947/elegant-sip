import { readFile, stat, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import { alertStaff } from './alerts.js'

/*
 * Server watchdog: emails the shop inbox when the server needs a person.
 *
 *   · the disk is nearly full (a full disk stops Postgres, and with it the shop)
 *   · the nightly backup failed, or has not run for over a day
 *   · the off-site copy of the backups failed, or has stopped running
 *
 * The backup and off-site containers report through small status files in a
 * shared volume (OPS_STATUS_DIR). Each file holds the Unix time of the event on
 * its first line, and failures add the error after it. Timestamps only, never
 * backup contents, so the API needs no access to the dumps themselves.
 *
 * It cannot report the whole server being down; the Uptime workflow in
 * .github/workflows/uptime.yml watches for that from outside.
 */

const HOUR = 60 * 60 * 1_000
/** Nightly backups: a day plus slack for a slow dump or a restart at 02:30. */
const BACKUP_MAX_AGE = 26 * HOUR
/** The off-site copy runs after each nightly dump; two missed nights is a problem. */
const OFFSITE_MAX_AGE = 50 * HOUR
/** A problem that persists is mentioned again once a day, not every check. */
const REPEAT_AFTER = 24 * HOUR

export interface StatusEvent {
  at: Date
  message?: string
}

export interface ServerSnapshot {
  disk: { freeBytes: number; totalBytes: number } | null
  /** Null when no status directory is configured (local development). */
  status: {
    backupOk?: StatusEvent
    backupFailed?: StatusEvent
    offsiteOk?: StatusEvent
    offsiteFailed?: StatusEvent
    /** Written instead of the others while off-site copies are not configured. */
    offsiteOff?: StatusEvent
  } | null
}

export interface Problem {
  /** Stable per kind of problem, so a repeat is recognised as the same one. */
  key: string
  subject: string
  body: string[]
}

const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`
const ist = (date: Date) =>
  date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST'
const newer = (a: StatusEvent | undefined, b: StatusEvent | undefined) => !!a && (!b || a.at > b.at)

/**
 * What is wrong right now. `upSince` is when this process started: a missing
 * status file only counts once the job it belongs to has had time to run.
 */
export function findProblems(
  snapshot: ServerSnapshot,
  options: { now: Date; upSince: Date; diskAlertPercent: number },
): Problem[] {
  const { now, upSince, diskAlertPercent } = options
  const problems: Problem[] = []
  const age = (event: StatusEvent | undefined) => now.getTime() - (event?.at ?? upSince).getTime()

  const { disk } = snapshot
  if (disk && disk.totalBytes > 0) {
    const freePercent = (disk.freeBytes / disk.totalBytes) * 100
    if (freePercent < diskAlertPercent) {
      problems.push({
        key: 'disk',
        subject: `Server disk is ${Math.round(100 - freePercent)}% full`,
        body: [
          `Only ${gb(disk.freeBytes)} of ${gb(disk.totalBytes)} is free on the server. When the disk fills, the database stops and the shop goes down.`,
          'On the server, `df -h` and `docker system df` show what is using it. `docker image prune -a` usually frees the most (old site builds), and old files in /var/www/elegant-sip/backups can go once they are copied off the server.',
        ],
      })
    }
  }

  const { status } = snapshot
  if (!status) return problems

  if (newer(status.backupFailed, status.backupOk)) {
    problems.push({
      key: 'backup-failed',
      subject: 'Last night’s database backup failed',
      body: [
        `The backup at ${ist(status.backupFailed!.at)} failed${status.backupFailed!.message ? `: ${status.backupFailed!.message}` : '.'}`,
        'The full error is in backups/last-error.log on the server. Take a manual backup (README, “Backups and restore”) until this is fixed.',
      ],
    })
  } else if (age(status.backupOk) > BACKUP_MAX_AGE) {
    problems.push({
      key: 'backup-stale',
      subject: 'No database backup in over a day',
      body: [
        status.backupOk
          ? `The last successful backup was at ${ist(status.backupOk.at)}.`
          : 'No successful backup has been recorded since the server last started.',
        'Check that the backup container is running: `docker compose -f docker-compose.prod.yml ps backup` and its logs.',
      ],
    })
  }

  // Not set up yet is the owner's decision, reported in the logs, not by email.
  if (newer(status.offsiteOff, status.offsiteOk) && newer(status.offsiteOff, status.offsiteFailed)) return problems

  if (newer(status.offsiteFailed, status.offsiteOk)) {
    problems.push({
      key: 'offsite-failed',
      subject: 'Off-site backup copy failed',
      body: [
        `Copying the backups off the server failed at ${ist(status.offsiteFailed!.at)}${status.offsiteFailed!.message ? `: ${status.offsiteFailed!.message}` : '.'}`,
        'Backups are still being made on the server, but a lost server would take them with it. Check the OFFSITE_ settings in .env and `docker compose -f docker-compose.prod.yml logs offsite`.',
      ],
    })
  } else if (age(status.offsiteOk) > OFFSITE_MAX_AGE) {
    problems.push({
      key: 'offsite-stale',
      subject: 'Backups have not been copied off the server in two days',
      body: [
        status.offsiteOk
          ? `The last off-site copy was at ${ist(status.offsiteOk.at)}.`
          : 'No off-site copy has been recorded since the server last started.',
        'Check that the offsite container is running: `docker compose -f docker-compose.prod.yml ps offsite` and its logs.',
      ],
    })
  }
  return problems
}

async function readEvent(file: string): Promise<StatusEvent | undefined> {
  try {
    const [text, info] = await Promise.all([readFile(file, 'utf8'), stat(file)])
    const [first = '', ...rest] = text.split('\n')
    const seconds = Number(first.trim())
    const message = rest.join(' ').replace(/\s+/g, ' ').trim().slice(0, 500)
    return {
      at: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1_000) : info.mtime,
      ...(message ? { message } : {}),
    }
  } catch {
    return undefined
  }
}

export async function readSnapshot(statusDir: string | undefined): Promise<ServerSnapshot> {
  let disk: ServerSnapshot['disk'] = null
  try {
    // The container's root lives on the host disk Docker uses, which also
    // holds the database volume, so this is the number that matters.
    const fs = await statfs('/')
    disk = { freeBytes: fs.bavail * fs.bsize, totalBytes: fs.blocks * fs.bsize }
  } catch {
    disk = null
  }
  if (!statusDir) return { disk, status: null }
  const [backupOk, backupFailed, offsiteOk, offsiteFailed, offsiteOff] = await Promise.all(
    ['backup-ok', 'backup-failed', 'offsite-ok', 'offsite-failed', 'offsite-off'].map((name) =>
      readEvent(join(statusDir, name)),
    ),
  )
  return { disk, status: { backupOk, backupFailed, offsiteOk, offsiteFailed, offsiteOff } }
}

interface Logger {
  info: (obj: object, msg: string) => void
  warn: (obj: object, msg: string) => void
  error: (obj: object, msg: string) => void
}

/**
 * Checks every `minutes` and emails each new problem once, then once a day
 * while it lasts. Returns the timer so the caller can unref it.
 */
export function startWatchdog(options: {
  minutes: number
  statusDir: string | undefined
  diskAlertPercent: number
  log: Logger
  alert?: typeof alertStaff
}): NodeJS.Timeout {
  const { minutes, statusDir, diskAlertPercent, log, alert = alertStaff } = options
  const upSince = new Date()
  const lastSent = new Map<string, number>()
  let warnedOffsiteOff = false

  const check = async () => {
    try {
      const snapshot = await readSnapshot(statusDir)
      const now = new Date()
      if (snapshot.status?.offsiteOff && !warnedOffsiteOff) {
        warnedOffsiteOff = true
        log.warn({}, 'OFF-SITE BACKUPS NOT CONFIGURED: nightly dumps stay on this server only. Set OFFSITE_S3_BUCKET and OFFSITE_ENCRYPT_PASSWORD (see .env.prod.example).')
      }
      const problems = findProblems(snapshot, { now, upSince, diskAlertPercent })
      const current = new Set(problems.map((p) => p.key))
      for (const key of lastSent.keys()) {
        if (!current.has(key)) {
          lastSent.delete(key)
          log.info({ problem: key }, 'watchdog: problem resolved')
        }
      }
      for (const problem of problems) {
        const sent = lastSent.get(problem.key)
        if (sent !== undefined && now.getTime() - sent < REPEAT_AFTER) continue
        lastSent.set(problem.key, now.getTime())
        log.error({ problem: problem.key }, `watchdog: ${problem.subject}`)
        await alert({ subject: problem.subject, body: problem.body })
      }
    } catch (err) {
      log.error({ err }, 'watchdog check failed')
    }
  }

  void check()
  return setInterval(() => void check(), minutes * 60_000)
}
