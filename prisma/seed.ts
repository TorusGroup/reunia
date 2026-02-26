import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

// =============================================================
// Prisma Seed — Test Data for Development (E1-S02)
// Run: npm run db:seed
// =============================================================

const prisma = new PrismaClient()

const BCRYPT_ROUNDS = 12

async function main() {
  console.log('Seeding database...')

  // ---------------------------------------------------------------
  // Organizations
  // ---------------------------------------------------------------
  const orgPlatform = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'ReunIA',
      shortName: 'REUNIA',
      type: 'platform',
      countryCode: 'BR',
      city: 'São Paulo',
      verified: true,
      metadata: { description: 'ReunIA platform organization' },
    },
    update: {},
  })

  const orgMaesDaSe = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Mães da Sé',
      shortName: 'MAESSE',
      type: 'ngo',
      countryCode: 'BR',
      stateCode: 'SP',
      city: 'São Paulo',
      websiteUrl: 'https://maesdase.org.br',
      verified: true,
      metadata: { founded: '1995', casesFound: 6000 },
    },
    update: {},
  })

  const orgPCSP = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Polícia Civil do Estado de São Paulo',
      shortName: 'PCSP',
      type: 'law_enforcement',
      countryCode: 'BR',
      stateCode: 'SP',
      city: 'São Paulo',
      verified: true,
    },
    update: {},
  })

  console.log('Organizations seeded:', { orgPlatform: orgPlatform.id, orgMaesDaSe: orgMaesDaSe.id, orgPCSP: orgPCSP.id })

  // ---------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------
  const adminPassword = await bcrypt.hash('Admin@ReunIA2026!', BCRYPT_ROUNDS)
  const familyPassword = await bcrypt.hash('Family@ReunIA2026!', BCRYPT_ROUNDS)
  const lePassword = await bcrypt.hash('LawEnf@ReunIA2026!', BCRYPT_ROUNDS)
  const devPassword = await bcrypt.hash('Dev@ReunIA2026!', BCRYPT_ROUNDS)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@reunia.org' },
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      email: 'admin@reunia.org',
      passwordHash: adminPassword,
      fullName: 'Admin ReunIA',
      role: 'admin',
      orgId: orgPlatform.id,
      emailVerified: true,
      privacyAcceptedAt: new Date(),
    },
    update: {},
  })

  const familyUser = await prisma.user.upsert({
    where: { email: 'renata.silva@example.com' },
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      email: 'renata.silva@example.com',
      passwordHash: familyPassword,
      fullName: 'Renata Silva (Família Teste)',
      role: 'family',
      phone: '+5511987654321',
      countryCode: 'BR',
      emailVerified: true,
      privacyAcceptedAt: new Date(),
    },
    update: {},
  })

  const leUser = await prisma.user.upsert({
    where: { email: 'delegado.teste@pcsp.sp.gov.br' },
    create: {
      id: '00000000-0000-0000-0000-000000000012',
      email: 'delegado.teste@pcsp.sp.gov.br',
      passwordHash: lePassword,
      fullName: 'Del. Ricardo Santos (Teste)',
      role: 'law_enforcement',
      orgId: orgPCSP.id,
      phone: '+5511912345678',
      countryCode: 'BR',
      emailVerified: true,
      privacyAcceptedAt: new Date(),
    },
    update: {},
  })

  const devUser = await prisma.user.upsert({
    where: { email: 'dev@reunia.org' },
    create: {
      id: '00000000-0000-0000-0000-000000000013',
      email: 'dev@reunia.org',
      passwordHash: devPassword,
      fullName: 'Dev User',
      role: 'admin',
      orgId: orgPlatform.id,
      emailVerified: true,
      privacyAcceptedAt: new Date(),
    },
    update: {},
  })

  console.log('Users seeded:', {
    admin: adminUser.email,
    family: familyUser.email,
    le: leUser.email,
    dev: devUser.email,
  })

  // ---------------------------------------------------------------
  // Data Sources (pre-configured external sources)
  // ---------------------------------------------------------------
  const dataSources = [
    {
      slug: 'fbi',
      name: 'FBI Wanted API',
      description: 'FBI Missing Persons — public API, no auth required',
      url: 'https://api.fbi.gov/wanted/v1/list',
      apiType: 'rest',
      authRequired: false,
      pollingIntervalMinutes: 720, // 12h
      config: { category: 'Missing Persons', limit: 100 },
    },
    {
      slug: 'interpol',
      name: 'Interpol Yellow Notices',
      description: 'Interpol Yellow Notices (missing persons) — public',
      url: 'https://ws-public.interpol.int/notices/v1/yellow',
      apiType: 'rest',
      authRequired: false,
      pollingIntervalMinutes: 1440, // 24h
      config: { ageMax: 18 },
    },
    {
      slug: 'ncmec',
      name: 'NCMEC Missing Kids Poster API',
      description: 'National Center for Missing & Exploited Children',
      url: 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet',
      apiType: 'rest',
      authRequired: true,
      pollingIntervalMinutes: 1440,
      config: { requiresRegistration: true },
    },
    {
      slug: 'amber',
      name: 'AMBER Alert RSS Feed',
      description: 'AMBER Alert public RSS feed',
      url: 'https://www.amberalert.gov/rss.xml',
      apiType: 'rss',
      authRequired: false,
      pollingIntervalMinutes: 60,
      config: {},
    },
    {
      slug: 'opensanctions',
      name: 'OpenSanctions',
      description: 'OpenSanctions international wanted persons database',
      url: 'https://api.opensanctions.org',
      apiType: 'rest',
      authRequired: false,
      pollingIntervalMinutes: 1440,
      config: { dataset: 'interpol_red_notices' },
    },
    {
      slug: 'cnpd',
      name: 'CNPD Brasil (Web Scraper)',
      description: 'Cadastro Nacional de Pessoas Desaparecidas — SENASP/MJ',
      url: 'https://www.gov.br/cnpd',
      apiType: 'scraper',
      authRequired: false,
      pollingIntervalMinutes: 2880, // 48h
      config: {},
    },
    {
      slug: 'disque100',
      name: 'Disque 100 (CSV Import)',
      description: 'SDH Disque 100 — CSV import de relatórios periódicos',
      apiType: 'csv_import',
      authRequired: false,
      pollingIntervalMinutes: 10080, // weekly
      config: {},
    },
    {
      slug: 'gdelt',
      name: 'GDELT News API',
      description: 'GDELT news monitoring for missing children mentions',
      url: 'https://api.gdeltproject.org/api/v2',
      apiType: 'rest',
      authRequired: false,
      pollingIntervalMinutes: 360, // 6h
      config: { keywords: ['missing child', 'criança desaparecida', 'niño desaparecido'] },
    },
    {
      slug: 'namus',
      name: 'NamUs Missing Persons (USA)',
      description: 'National Missing and Unidentified Persons System',
      url: 'https://namus.nij.ojp.gov',
      apiType: 'rest',
      authRequired: true,
      pollingIntervalMinutes: 1440,
      config: {},
    },
  ]

  for (const source of dataSources) {
    await prisma.dataSource.upsert({
      where: { slug: source.slug },
      create: source,
      update: { isActive: true },
    })
  }

  console.log(`Data sources seeded: ${dataSources.length}`)

  // ---------------------------------------------------------------
  // Sample Cases (10 fictional cases for development/testing)
  // Using fictional names and details — NOT real missing children
  // ---------------------------------------------------------------
  const sampleCases = [
    {
      caseNumber: 'REUNIA-BR-2026-000001',
      caseType: 'missing' as const,
      status: 'active' as const,
      urgency: 'high' as const,
      reportedAt: new Date('2026-01-15T14:30:00Z'),
      lastSeenAt: new Date('2026-01-15T12:00:00Z'),
      lastSeenLocation: 'Terminal Tietê, São Paulo, SP',
      lastSeenLat: -23.5163,
      lastSeenLng: -46.6202,
      lastSeenCountry: 'BR',
      circumstances: 'Criança ficou separada da família no terminal rodoviário.',
      source: 'platform' as const,
      dataQuality: 72,
      consentGiven: true,
      consentType: 'parental' as const,
      reportedById: familyUser.id,
      firstName: 'João',
      lastName: 'Fictício',
      age: 9,
      gender: 'male' as const,
    },
    {
      caseNumber: 'REUNIA-BR-2026-000002',
      caseType: 'missing' as const,
      status: 'active' as const,
      urgency: 'standard' as const,
      reportedAt: new Date('2026-01-20T09:15:00Z'),
      lastSeenAt: new Date('2026-01-19T17:00:00Z'),
      lastSeenLocation: 'Escola Municipal, Campinas, SP',
      lastSeenLat: -22.9056,
      lastSeenLng: -47.0608,
      lastSeenCountry: 'BR',
      circumstances: 'Saiu da escola e não retornou para casa.',
      source: 'platform' as const,
      dataQuality: 65,
      consentGiven: true,
      consentType: 'parental' as const,
      reportedById: familyUser.id,
      firstName: 'Maria',
      lastName: 'Fictícia',
      age: 12,
      gender: 'female' as const,
    },
    {
      caseNumber: 'REUNIA-US-2026-000001',
      caseType: 'abduction_nonfamily' as const,
      status: 'active' as const,
      urgency: 'critical' as const,
      reportedAt: new Date('2026-02-01T08:00:00Z'),
      lastSeenAt: new Date('2026-02-01T06:30:00Z'),
      lastSeenLocation: 'Central Park, New York, NY',
      lastSeenLat: 40.7829,
      lastSeenLng: -73.9654,
      lastSeenCountry: 'US',
      circumstances: 'AMBER Alert issued. Child taken from park.',
      source: 'amber' as const,
      dataQuality: 85,
      consentGiven: true,
      consentType: 'law_enforcement_override' as const,
      reportedById: adminUser.id,
      firstName: 'Alex',
      lastName: 'Sample',
      age: 7,
      gender: 'other' as const,
    },
    {
      caseNumber: 'REUNIA-BR-2026-000003',
      caseType: 'runaway' as const,
      status: 'active' as const,
      urgency: 'standard' as const,
      reportedAt: new Date('2026-02-05T11:00:00Z'),
      lastSeenAt: new Date('2026-02-04T22:00:00Z'),
      lastSeenLocation: 'Bairro Santa Cruz, Rio de Janeiro, RJ',
      lastSeenLat: -22.9068,
      lastSeenLng: -43.1729,
      lastSeenCountry: 'BR',
      circumstances: 'Adolescente saiu de casa após conflito familiar.',
      source: 'platform' as const,
      dataQuality: 58,
      consentGiven: true,
      consentType: 'parental' as const,
      reportedById: familyUser.id,
      firstName: 'Pedro',
      lastName: 'Teste',
      age: 15,
      gender: 'male' as const,
    },
    {
      caseNumber: 'REUNIA-INT-2026-000001',
      caseType: 'missing' as const,
      status: 'active' as const,
      urgency: 'high' as const,
      reportedAt: new Date('2026-02-10T09:00:00Z'),
      lastSeenAt: new Date('2026-02-09T15:00:00Z'),
      lastSeenLocation: 'Bogotá, Colombia',
      lastSeenLat: 4.7110,
      lastSeenLng: -74.0721,
      lastSeenCountry: 'CO',
      circumstances: 'Interpol Yellow Notice. Family looking for child.',
      source: 'interpol' as const,
      dataQuality: 70,
      consentGiven: true,
      consentType: 'vital_interest' as const,
      reportedById: adminUser.id,
      firstName: 'Sofia',
      lastName: 'Internacional',
      age: 10,
      gender: 'female' as const,
    },
  ]

  for (const caseData of sampleCases) {
    const {
      firstName,
      lastName,
      age,
      gender,
      ...caseFields
    } = caseData

    const existingCase = await prisma.case.findUnique({
      where: { caseNumber: caseFields.caseNumber },
    })

    if (!existingCase) {
      await prisma.case.create({
        data: {
          ...caseFields,
          consentGivenAt: caseFields.consentGiven ? new Date() : undefined,
          persons: {
            create: [
              {
                role: 'missing_child',
                firstName,
                lastName,
                approximateAge: age,
                gender,
              },
            ],
          },
        },
      })
    }
  }

  console.log(`Sample cases seeded: ${sampleCases.length}`)

  // ---------------------------------------------------------------
  // Alert Subscription sample
  // ---------------------------------------------------------------
  await prisma.alertSubscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      channel: 'whatsapp',
      contactIdentifier: '+5511999999999',
      radiusKm: 50,
      isActive: true,
      consentGivenAt: new Date(),
      consentIp: '127.0.0.1',
      unsubscribeToken: uuidv4(),
      userId: familyUser.id,
    },
    update: {},
  })

  console.log('Alert subscriptions seeded')
  console.log('Seed complete!')
  console.log('\nDev accounts:')
  console.log('  Admin:   admin@reunia.org         / Admin@ReunIA2026!')
  console.log('  Family:  renata.silva@example.com / Family@ReunIA2026!')
  console.log('  LE:      delegado.teste@pcsp...   / LawEnf@ReunIA2026!')
  console.log('  Dev:     dev@reunia.org            / Dev@ReunIA2026!')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('Seed failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
