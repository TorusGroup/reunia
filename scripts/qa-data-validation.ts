#!/usr/bin/env npx tsx
// =============================================================
// QA Data Validation Script — DS-04 (Sprint 5)
// Validates data quality in the database after ingestion
// Usage: npx tsx scripts/qa-data-validation.ts
// =============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ValidationResult {
  check: string
  status: 'PASS' | 'FAIL' | 'WARN'
  expected: string
  actual: string
  details?: string
}

const results: ValidationResult[] = []

function log(msg: string) {
  console.log(`[qa-validate] ${msg}`)
}

function addResult(r: ValidationResult) {
  results.push(r)
  const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'WARN'
  log(`  [${icon}] ${r.check}: expected ${r.expected}, got ${r.actual}${r.details ? ` — ${r.details}` : ''}`)
}

async function main() {
  log('=== QA Data Validation Starting ===')
  log('')

  // ---------------------------------------------------------------
  // CHECK 1: Total cases >= 500 (NCMEC target)
  // ---------------------------------------------------------------
  log('Check 1: Total case count')
  const totalCases = await prisma.case.count()
  addResult({
    check: 'Total cases in DB',
    status: totalCases >= 500 ? 'PASS' : totalCases >= 100 ? 'WARN' : 'FAIL',
    expected: '>= 500',
    actual: String(totalCases),
  })

  // ---------------------------------------------------------------
  // CHECK 2: Active cases > 0
  // ---------------------------------------------------------------
  log('Check 2: Active cases')
  const activeCases = await prisma.case.count({ where: { status: 'active' } })
  addResult({
    check: 'Active cases',
    status: activeCases > 0 ? 'PASS' : 'FAIL',
    expected: '> 0',
    actual: String(activeCases),
  })

  // ---------------------------------------------------------------
  // CHECK 3: NCMEC cases specifically
  // ---------------------------------------------------------------
  log('Check 3: NCMEC source cases')
  const ncmecCases = await prisma.case.count({ where: { source: 'ncmec' } })
  addResult({
    check: 'NCMEC cases',
    status: ncmecCases >= 100 ? 'PASS' : ncmecCases > 0 ? 'WARN' : 'FAIL',
    expected: '>= 100',
    actual: String(ncmecCases),
  })

  // ---------------------------------------------------------------
  // CHECK 4: Cases have person records (not orphaned)
  // ---------------------------------------------------------------
  log('Check 4: Cases with associated persons')
  const casesWithPersons = await prisma.case.count({
    where: { persons: { some: { role: 'missing_child' } } },
  })
  const orphanedCases = totalCases - casesWithPersons
  addResult({
    check: 'Cases with person records',
    status: orphanedCases === 0 ? 'PASS' : orphanedCases < 10 ? 'WARN' : 'FAIL',
    expected: `${totalCases} (all have persons)`,
    actual: `${casesWithPersons} (${orphanedCases} orphaned)`,
  })

  // ---------------------------------------------------------------
  // CHECK 5: Data quality — firstName not null
  // ---------------------------------------------------------------
  log('Check 5: Persons with firstName populated')
  const totalPersons = await prisma.person.count({ where: { role: 'missing_child' } })
  const personsWithFirstName = await prisma.person.count({
    where: { role: 'missing_child', firstName: { not: null } },
  })
  const firstNameRate = totalPersons > 0 ? Math.round((personsWithFirstName / totalPersons) * 100) : 0
  addResult({
    check: 'Persons with firstName',
    status: firstNameRate >= 90 ? 'PASS' : firstNameRate >= 70 ? 'WARN' : 'FAIL',
    expected: '>= 90%',
    actual: `${firstNameRate}% (${personsWithFirstName}/${totalPersons})`,
  })

  // ---------------------------------------------------------------
  // CHECK 6: Data quality — lastName not null
  // ---------------------------------------------------------------
  log('Check 6: Persons with lastName populated')
  const personsWithLastName = await prisma.person.count({
    where: { role: 'missing_child', lastName: { not: null } },
  })
  const lastNameRate = totalPersons > 0 ? Math.round((personsWithLastName / totalPersons) * 100) : 0
  addResult({
    check: 'Persons with lastName',
    status: lastNameRate >= 80 ? 'PASS' : lastNameRate >= 60 ? 'WARN' : 'FAIL',
    expected: '>= 80%',
    actual: `${lastNameRate}% (${personsWithLastName}/${totalPersons})`,
  })

  // ---------------------------------------------------------------
  // CHECK 7: Cases with photos (images)
  // ---------------------------------------------------------------
  log('Check 7: Cases with photos')
  const casesWithPhotos = await prisma.case.count({
    where: {
      persons: {
        some: {
          role: 'missing_child',
          images: { some: {} },
        },
      },
    },
  })
  const photoRate = totalCases > 0 ? Math.round((casesWithPhotos / totalCases) * 100) : 0
  addResult({
    check: 'Cases with photos',
    status: photoRate >= 70 ? 'PASS' : photoRate >= 40 ? 'WARN' : 'FAIL',
    expected: '>= 70%',
    actual: `${photoRate}% (${casesWithPhotos}/${totalCases})`,
  })

  // ---------------------------------------------------------------
  // CHECK 8: No duplicate externalIds within same source
  // ---------------------------------------------------------------
  log('Check 8: Dedup — no duplicate sourceId within same source')
  const duplicates = await prisma.$queryRaw<Array<{ source: string; source_id: string; cnt: bigint }>>`
    SELECT source, source_id, COUNT(*) as cnt
    FROM cases
    WHERE source_id IS NOT NULL
    GROUP BY source, source_id
    HAVING COUNT(*) > 1
    LIMIT 20
  `
  const dupCount = duplicates.length
  addResult({
    check: 'No duplicate source+sourceId pairs',
    status: dupCount === 0 ? 'PASS' : dupCount < 5 ? 'WARN' : 'FAIL',
    expected: '0 duplicates',
    actual: `${dupCount} duplicate pairs`,
    details: dupCount > 0 ? duplicates.slice(0, 3).map(d => `${d.source}:${d.source_id}(x${d.cnt})`).join(', ') : undefined,
  })

  // ---------------------------------------------------------------
  // CHECK 9: Data sources are tracked
  // ---------------------------------------------------------------
  log('Check 9: DataSource records exist')
  const dataSources = await prisma.dataSource.findMany({
    select: { slug: true, isActive: true, lastSuccessAt: true, totalRecordsFetched: true },
  })
  addResult({
    check: 'DataSource records',
    status: dataSources.length >= 2 ? 'PASS' : dataSources.length >= 1 ? 'WARN' : 'FAIL',
    expected: '>= 2 sources',
    actual: `${dataSources.length} sources: ${dataSources.map(ds => `${ds.slug}(${ds.totalRecordsFetched})`).join(', ')}`,
  })

  // ---------------------------------------------------------------
  // CHECK 10: Ingestion logs exist
  // ---------------------------------------------------------------
  log('Check 10: Ingestion logs')
  const recentLogs = await prisma.ingestionLog.findMany({
    where: { status: 'success' },
    orderBy: { completedAt: 'desc' },
    take: 5,
    select: {
      dataSource: { select: { slug: true } },
      recordsInserted: true,
      completedAt: true,
    },
  })
  addResult({
    check: 'Successful ingestion logs',
    status: recentLogs.length > 0 ? 'PASS' : 'FAIL',
    expected: '>= 1 successful log',
    actual: `${recentLogs.length} logs`,
    details: recentLogs.slice(0, 3).map(l => `${l.dataSource.slug}: +${l.recordsInserted} @ ${l.completedAt?.toISOString().slice(0, 16)}`).join('; '),
  })

  // ---------------------------------------------------------------
  // CHECK 11: Stats endpoint data consistency
  // ---------------------------------------------------------------
  log('Check 11: Stats data consistency')
  const distinctSources = await prisma.case.groupBy({
    by: ['source'],
    where: { status: 'active' },
  })
  addResult({
    check: 'Distinct active sources in cases',
    status: distinctSources.length >= 1 ? 'PASS' : 'FAIL',
    expected: '>= 1',
    actual: `${distinctSources.length} sources: ${distinctSources.map(s => s.source).join(', ')}`,
  })

  // ---------------------------------------------------------------
  // CHECK 12: Cases by source distribution
  // ---------------------------------------------------------------
  log('Check 12: Cases by source breakdown')
  const bySource = await prisma.case.groupBy({
    by: ['source'],
    _count: true,
    orderBy: { _count: { source: 'desc' } },
  })
  for (const src of bySource) {
    log(`    ${src.source}: ${src._count} cases`)
  }
  addResult({
    check: 'Source distribution',
    status: bySource.length >= 1 ? 'PASS' : 'FAIL',
    expected: 'At least 1 source',
    actual: bySource.map(s => `${s.source}=${s._count}`).join(', '),
  })

  // ---------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------
  log('')
  log('=== QA Validation Summary ===')
  const passed = results.filter(r => r.status === 'PASS').length
  const warned = results.filter(r => r.status === 'WARN').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const total = results.length

  log(`  PASS: ${passed}/${total}`)
  log(`  WARN: ${warned}/${total}`)
  log(`  FAIL: ${failed}/${total}`)

  const overallScore = Math.round(((passed * 1 + warned * 0.5) / total) * 100)
  log(`  Score: ${overallScore}/100`)

  const gate = failed === 0 ? 'PASS' : failed <= 2 ? 'CONDITIONAL PASS' : 'FAIL'
  log(`  Gate: ${gate}`)

  if (failed > 0) {
    log('')
    log('  Failed checks:')
    for (const r of results.filter(r => r.status === 'FAIL')) {
      log(`    - ${r.check}: expected ${r.expected}, got ${r.actual}`)
    }
  }

  log('')
  log('=== QA Validation Complete ===')

  await prisma.$disconnect()

  // Exit code: 0 if gate passes, 1 if fails
  process.exit(gate === 'FAIL' ? 1 : 0)
}

main().catch(async (err) => {
  console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`)
  await prisma.$disconnect()
  process.exit(1)
})
