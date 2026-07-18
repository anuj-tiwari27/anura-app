/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@anura.legal';
const DEMO_PASSWORD = 'anura1234';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 30, 0, 0);
  return d;
}

async function main(): Promise<void> {
  console.log('Seeding Anura demo data...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      fullName: 'Adv. Ananya Rao',
      phone: '+91 9810012345',
      city: 'New Delhi',
      state: 'Delhi',
      role: 'LAWYER',
      emailVerified: true,
      onboardingComplete: true,
    },
  });

  const lawyer = await prisma.lawyer.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      barCouncilId: 'D/1234/2015',
      enrollmentYear: 2015,
      experienceYears: 9,
      practiceAreas: ['CIVIL', 'CORPORATE', 'PROPERTY'],
      courts: ['Delhi High Court', 'Saket District Court'],
      primaryCourtType: 'HIGH_COURT',
      bio: 'Commercial and civil litigation before the Delhi High Court.',
    },
  });

  await prisma.subscription.upsert({
    where: { lawyerId: lawyer.id },
    update: {},
    create: {
      lawyerId: lawyer.id,
      plan: 'SOLO',
      status: 'ACTIVE',
      seats: 1,
      provider: 'seed',
      currentPeriodEnd: daysFromNow(30),
    },
  });

  const existingCases = await prisma.case.count({ where: { lawyerId: lawyer.id } });
  if (existingCases === 0) {
    const case1 = await prisma.case.create({
      data: {
        lawyerId: lawyer.id,
        title: 'Mehta Textiles v. Sunrise Logistics',
        caseNumber: 'CS(COMM) 482/2025',
        cnr: 'DLHC010048252025',
        court: 'Delhi High Court',
        courtType: 'HIGH_COURT',
        jurisdiction: 'Delhi',
        practiceArea: 'CORPORATE',
        status: 'ACTIVE',
        clientName: 'Mehta Textiles Pvt. Ltd.',
        description: 'Recovery suit arising out of a breach of a logistics services agreement.',
        filedAt: daysFromNow(-45),
        nextHearingDate: daysFromNow(6),
        parties: {
          create: [
            { name: 'Mehta Textiles Pvt. Ltd.', role: 'PLAINTIFF', isClient: true, contactEmail: 'legal@mehtatextiles.in' },
            { name: 'Sunrise Logistics Ltd.', role: 'DEFENDANT', advocateName: 'Adv. R. Khanna' },
          ],
        },
        timeline: {
          create: [
            { type: 'FILING', title: 'Plaint filed', eventDate: daysFromNow(-45) },
            { type: 'ORDER', title: 'Summons issued', eventDate: daysFromNow(-30) },
            { type: 'HEARING', title: 'Arguments on interim injunction', eventDate: daysFromNow(6) },
          ],
        },
        notes: {
          create: [{ authorId: user.id, body: 'Client to provide signed delivery challans before next hearing.' }],
        },
      },
    });

    const case2 = await prisma.case.create({
      data: {
        lawyerId: lawyer.id,
        title: 'State v. Rakesh Kumar',
        caseNumber: 'SC 219/2025',
        court: 'Saket District Court',
        courtType: 'DISTRICT_COURT',
        jurisdiction: 'Delhi',
        practiceArea: 'CRIMINAL',
        status: 'ACTIVE',
        clientName: 'Rakesh Kumar',
        description: 'Defence in a cheque dishonour matter under Section 138 NI Act.',
        filedAt: daysFromNow(-90),
        nextHearingDate: daysFromNow(2),
        parties: {
          create: [
            { name: 'State (NCT of Delhi)', role: 'COMPLAINANT' },
            { name: 'Rakesh Kumar', role: 'ACCUSED', isClient: true },
          ],
        },
        timeline: {
          create: [
            { type: 'FILING', title: 'Complaint registered', eventDate: daysFromNow(-90) },
            { type: 'HEARING', title: 'Cross-examination of complainant', eventDate: daysFromNow(2) },
          ],
        },
      },
    });

    await prisma.case.create({
      data: {
        lawyerId: lawyer.id,
        title: 'Verma Estate Partition',
        court: 'Delhi High Court',
        courtType: 'HIGH_COURT',
        practiceArea: 'PROPERTY',
        status: 'ON_HOLD',
        clientName: 'Sunita Verma',
        description: 'Partition suit among co-owners of ancestral property in Civil Lines.',
        filedAt: daysFromNow(-120),
        parties: {
          create: [{ name: 'Sunita Verma', role: 'PLAINTIFF', isClient: true }],
        },
      },
    });

    await prisma.invoice.create({
      data: {
        lawyerId: lawyer.id,
        caseId: case1.id,
        number: 'INV-2025-0001',
        status: 'SENT',
        clientName: 'Mehta Textiles Pvt. Ltd.',
        currency: 'INR',
        subtotal: 60000,
        gstPercent: 18,
        gstAmount: 10800,
        total: 70800,
        items: [
          { description: 'Drafting of plaint and interim application', quantity: 1, unitPrice: 40000, amount: 40000 },
          { description: 'Appearance - interim hearing', quantity: 2, unitPrice: 10000, amount: 20000 },
        ],
        issuedAt: daysFromNow(-10),
        dueAt: daysFromNow(20),
      },
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          type: 'HEARING_REMINDER',
          title: 'Hearing in 2 days',
          body: 'State v. Rakesh Kumar - cross-examination at Saket District Court.',
          link: `/cases/${case2.id}`,
        },
        {
          userId: user.id,
          type: 'CASE_UPDATE',
          title: 'Interim application listed',
          body: 'Mehta Textiles v. Sunrise Logistics is listed this week.',
          link: `/cases/${case1.id}`,
          read: true,
        },
      ],
    });
  }

  // Landmark judgements for the research module (embeddings generated on demand).
  const judgements = [
    {
      title: 'Kesavananda Bharati v. State of Kerala',
      court: 'Supreme Court of India',
      citation: '(1973) 4 SCC 225',
      practiceArea: 'CONSTITUTIONAL' as const,
      decidedAt: new Date('1973-04-24'),
      summary: 'Established the basic structure doctrine limiting Parliament\'s power to amend the Constitution.',
    },
    {
      title: 'Maneka Gandhi v. Union of India',
      court: 'Supreme Court of India',
      citation: '(1978) 1 SCC 248',
      practiceArea: 'CONSTITUTIONAL' as const,
      decidedAt: new Date('1978-01-25'),
      summary: 'Expanded Article 21; procedure established by law must be just, fair and reasonable.',
    },
    {
      title: 'Vishaka v. State of Rajasthan',
      court: 'Supreme Court of India',
      citation: '(1997) 6 SCC 241',
      practiceArea: 'LABOUR' as const,
      decidedAt: new Date('1997-08-13'),
      summary: 'Laid down guidelines against sexual harassment of women at the workplace.',
    },
    {
      title: 'K.S. Puttaswamy v. Union of India',
      court: 'Supreme Court of India',
      citation: '(2017) 10 SCC 1',
      practiceArea: 'CONSTITUTIONAL' as const,
      decidedAt: new Date('2017-08-24'),
      summary: 'Recognised the right to privacy as a fundamental right under Article 21.',
    },
    {
      title: 'M/s Kanchan Udyog v. United Spirits',
      court: 'Supreme Court of India',
      citation: '(2017) 8 SCC 237',
      practiceArea: 'CORPORATE' as const,
      decidedAt: new Date('2017-05-05'),
      summary: 'Principles on damages for breach of a distributorship/commercial agreement.',
    },
  ];

  for (const j of judgements) {
    const exists = await prisma.judgement.findFirst({ where: { title: j.title } });
    if (!exists) await prisma.judgement.create({ data: j });
  }

  // System draft templates
  const templates = [
    { name: 'Legal Notice (General)', type: 'NOTICE' as const, body: 'To,\n{{recipient}}\n\nUnder instructions from my client {{client}}, I hereby serve upon you this legal notice...' },
    { name: 'Bail Application', type: 'PETITION' as const, body: 'IN THE COURT OF {{court}}\n\nApplication under Section 439 CrPC for grant of bail...' },
    { name: 'Affidavit', type: 'AFFIDAVIT' as const, body: 'I, {{deponent}}, do hereby solemnly affirm and declare as under:' },
  ];
  for (const t of templates) {
    const exists = await prisma.template.findFirst({ where: { name: t.name, isSystem: true } });
    if (!exists) await prisma.template.create({ data: { ...t, isSystem: true } });
  }

  console.log(`Seed complete. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
