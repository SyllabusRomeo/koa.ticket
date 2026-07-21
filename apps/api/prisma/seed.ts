import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PERMISSIONS, ROLES } from '@logit/shared';

const prisma = new PrismaClient();

const ROLE_DEFS: Array<{
  code: string;
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    code: ROLES.EMPLOYEE,
    name: 'Employee',
    description: 'Requester / self-service user',
    permissions: [
      PERMISSIONS.TICKETS_READ_OWN,
      PERMISSIONS.TICKETS_WRITE,
      PERMISSIONS.KNOWLEDGE_READ,
    ],
  },
  {
    code: ROLES.AGENT,
    name: 'IT Support Agent',
    description: 'Service desk agent',
    permissions: [
      PERMISSIONS.TICKETS_READ_OWN,
      PERMISSIONS.TICKETS_READ_QUEUE,
      PERMISSIONS.TICKETS_WRITE,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_INTERNAL_NOTE,
      PERMISSIONS.KNOWLEDGE_READ,
      PERMISSIONS.ASSETS_READ,
      PERMISSIONS.ORG_READ,
    ],
  },
  {
    code: ROLES.SENIOR_AGENT,
    name: 'Senior IT Agent',
    description: 'Tier 2 / Tier 3',
    permissions: [
      PERMISSIONS.TICKETS_READ_OWN,
      PERMISSIONS.TICKETS_READ_QUEUE,
      PERMISSIONS.TICKETS_WRITE,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_INTERNAL_NOTE,
      PERMISSIONS.KNOWLEDGE_READ,
      PERMISSIONS.KNOWLEDGE_WRITE,
      PERMISSIONS.ASSETS_READ,
      PERMISSIONS.ASSETS_WRITE,
      PERMISSIONS.ORG_READ,
    ],
  },
  {
    code: ROLES.IT_MANAGER,
    name: 'IT Manager',
    description: 'Operational oversight',
    permissions: [
      PERMISSIONS.TICKETS_READ_ALL,
      PERMISSIONS.TICKETS_WRITE,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_INTERNAL_NOTE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.ORG_READ,
      PERMISSIONS.ORG_MANAGE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.KNOWLEDGE_READ,
      PERMISSIONS.KNOWLEDGE_WRITE,
      PERMISSIONS.ASSETS_READ,
      PERMISSIONS.ASSETS_WRITE,
    ],
  },
  {
    code: ROLES.APPROVER,
    name: 'Department Manager / Approver',
    description: 'Approves service requests',
    permissions: [
      PERMISSIONS.TICKETS_READ_OWN,
      PERMISSIONS.KNOWLEDGE_READ,
    ],
  },
  {
    code: ROLES.SYSADMIN,
    name: 'System Administrator',
    description: 'Full platform administration',
    permissions: Object.values(PERMISSIONS),
  },
  {
    code: ROLES.AUDITOR,
    name: 'Auditor',
    description: 'Read-only audit access',
    permissions: [
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.TICKETS_READ_ALL,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.ASSETS_READ,
    ],
  },
];

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: 'app.name' },
    update: { value: 'LogIT' },
    create: { key: 'app.name', value: 'LogIT' },
  });

  for (const code of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      update: { name: code },
      create: { code, name: code },
    });
  }

  for (const role of ROLE_DEFS) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
      },
    });

    for (const permCode of role.permissions) {
      const perm = await prisma.permission.findUniqueOrThrow({
        where: { code: permCode },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: saved.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: saved.id, permissionId: perm.id },
      });
    }
  }

  const hq = await prisma.location.upsert({
    where: { code: 'HQ-ACC' },
    update: {},
    create: {
      code: 'HQ-ACC',
      name: 'Head Office — Accra',
      country: 'GH',
      site: 'Accra HQ',
      timezone: 'Africa/Accra',
    },
  });

  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: {
      code: 'IT',
      name: 'Information Technology',
      locationId: hq.id,
    },
  });

  await prisma.department.upsert({
    where: { code: 'OPS' },
    update: {},
    create: {
      code: 'OPS',
      name: 'Operations',
      locationId: hq.id,
    },
  });

  const serviceDesk = await prisma.team.upsert({
    where: { code: 'SD' },
    update: {},
    create: {
      code: 'SD',
      name: 'Service Desk',
      description: 'Tier-1 IT support',
      locationId: hq.id,
      departmentId: itDept.id,
    },
  });

  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ?? 'admin@logit.local'
  ).toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'LogIT-Admin-2026!';
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
  });
  const sysadmin = await prisma.role.findUniqueOrThrow({
    where: { code: ROLES.SYSADMIN },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      isActive: true,
      deletedAt: null,
      departmentId: itDept.id,
      locationId: hq.id,
    },
    create: {
      email: adminEmail,
      firstName: 'System',
      lastName: 'Administrator',
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      departmentId: itDept.id,
      locationId: hq.id,
      roles: { create: [{ roleId: sysadmin.id }] },
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: admin.id, roleId: sysadmin.id },
    },
    update: {},
    create: { userId: admin.id, roleId: sysadmin.id },
  });

  await prisma.teamMember.upsert({
    where: {
      teamId_userId: { teamId: serviceDesk.id, userId: admin.id },
    },
    update: { isLead: true },
    create: { teamId: serviceDesk.id, userId: admin.id, isLead: true },
  });

  const employeeRole = await prisma.role.findUniqueOrThrow({
    where: { code: ROLES.EMPLOYEE },
  });
  const demoEmail = 'employee@logit.local';
  const demoHash = await argon2.hash('LogIT-Employee-2026!', {
    type: argon2.argon2id,
  });
  const employee = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { passwordHash: demoHash, isActive: true, deletedAt: null },
    create: {
      email: demoEmail,
      firstName: 'Ama',
      lastName: 'Mensah',
      passwordHash: demoHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      locationId: hq.id,
      roles: { create: [{ roleId: employeeRole.id }] },
    },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: employee.id, roleId: employeeRole.id },
    },
    update: {},
    create: { userId: employee.id, roleId: employeeRole.id },
  });

  // Phase 3 — ticket metadata
  const typeDefs = [
    { code: 'incident', name: 'Incident', prefix: 'INC' },
    { code: 'service_request', name: 'Service Request', prefix: 'REQ' },
    { code: 'access_request', name: 'Access Request', prefix: 'ACC' },
    { code: 'security_incident', name: 'Security Incident', prefix: 'SEC' },
    { code: 'problem', name: 'Problem', prefix: 'PRB' },
    { code: 'change', name: 'Change', prefix: 'CHG' },
    { code: 'task', name: 'Task', prefix: 'TSK' },
  ];
  for (const t of typeDefs) {
    await prisma.ticketType.upsert({
      where: { code: t.code },
      update: { name: t.name, prefix: t.prefix, isActive: true },
      create: t,
    });
  }

  const statusDefs = [
    { code: 'new', name: 'New', sortOrder: 10 },
    { code: 'open', name: 'Open', sortOrder: 20 },
    { code: 'assigned', name: 'Assigned', sortOrder: 30 },
    { code: 'in_progress', name: 'In Progress', sortOrder: 40 },
    { code: 'pending_user', name: 'Pending User', sortOrder: 50, pausesSla: true },
    { code: 'pending_vendor', name: 'Pending Vendor', sortOrder: 60, pausesSla: true },
    { code: 'pending_approval', name: 'Pending Approval', sortOrder: 70, pausesSla: true },
    { code: 'on_hold', name: 'On Hold', sortOrder: 80, pausesSla: true },
    { code: 'resolved', name: 'Resolved', sortOrder: 90 },
    { code: 'closed', name: 'Closed', sortOrder: 100, isTerminal: true },
    { code: 'cancelled', name: 'Cancelled', sortOrder: 110, isTerminal: true },
  ];
  for (const s of statusDefs) {
    await prisma.ticketStatus.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        sortOrder: s.sortOrder,
        pausesSla: s.pausesSla ?? false,
        isTerminal: s.isTerminal ?? false,
      },
      create: {
        code: s.code,
        name: s.name,
        sortOrder: s.sortOrder,
        pausesSla: s.pausesSla ?? false,
        isTerminal: s.isTerminal ?? false,
      },
    });
  }

  const statuses = await prisma.ticketStatus.findMany();
  const byCode = Object.fromEntries(statuses.map((s) => [s.code, s.id]));
  const transitions: Array<[string, string]> = [
    ['new', 'open'],
    ['new', 'assigned'],
    ['new', 'cancelled'],
    ['open', 'assigned'],
    ['open', 'in_progress'],
    ['open', 'cancelled'],
    ['assigned', 'in_progress'],
    ['assigned', 'pending_user'],
    ['in_progress', 'pending_user'],
    ['in_progress', 'pending_vendor'],
    ['in_progress', 'pending_approval'],
    ['in_progress', 'on_hold'],
    ['in_progress', 'resolved'],
    ['pending_user', 'in_progress'],
    ['pending_vendor', 'in_progress'],
    ['pending_approval', 'in_progress'],
    ['pending_approval', 'cancelled'],
    ['on_hold', 'in_progress'],
    ['resolved', 'closed'],
    ['resolved', 'open'],
    ['closed', 'open'],
  ];
  for (const [from, to] of transitions) {
    await prisma.ticketStatusTransition.upsert({
      where: {
        fromStatusId_toStatusId: {
          fromStatusId: byCode[from],
          toStatusId: byCode[to],
        },
      },
      update: {},
      create: {
        fromStatusId: byCode[from],
        toStatusId: byCode[to],
      },
    });
  }

  const priorityDefs = [
    { code: 'p1_critical', name: 'P1 Critical', rank: 1 },
    { code: 'p2_high', name: 'P2 High', rank: 2 },
    { code: 'p3_medium', name: 'P3 Medium', rank: 3 },
    { code: 'p4_low', name: 'P4 Low', rank: 4 },
    { code: 'p5_planning', name: 'P5 Planning', rank: 5 },
  ];
  for (const p of priorityDefs) {
    await prisma.priority.upsert({
      where: { code: p.code },
      update: { name: p.name, rank: p.rank },
      create: p,
    });
  }
  const priorities = await prisma.priority.findMany();
  const pByCode = Object.fromEntries(priorities.map((p) => [p.code, p.id]));
  const matrix: Array<[string, string, string]> = [
    ['high', 'high', 'p1_critical'],
    ['high', 'medium', 'p2_high'],
    ['medium', 'high', 'p2_high'],
    ['medium', 'medium', 'p3_medium'],
    ['low', 'medium', 'p4_low'],
    ['low', 'low', 'p5_planning'],
    ['high', 'low', 'p3_medium'],
    ['medium', 'low', 'p4_low'],
    ['low', 'high', 'p3_medium'],
  ];
  for (const [impact, urgency, priorityCode] of matrix) {
    await prisma.priorityMatrix.upsert({
      where: { impact_urgency: { impact, urgency } },
      update: { priorityId: pByCode[priorityCode] },
      create: {
        impact,
        urgency,
        priorityId: pByCode[priorityCode],
      },
    });
  }

  const categorySeed = [
    {
      code: 'HARDWARE',
      name: 'Hardware',
      subs: [
        ['LAPTOP', 'Laptop'],
        ['DESKTOP', 'Desktop'],
        ['PRINTER', 'Printer'],
      ],
    },
    {
      code: 'SOFTWARE',
      name: 'Software',
      subs: [
        ['M365', 'Microsoft 365'],
        ['ERP', 'ERP'],
        ['OS', 'Operating system'],
      ],
    },
    {
      code: 'NETWORK',
      name: 'Network',
      subs: [
        ['WIFI', 'Wi-Fi'],
        ['VPN', 'VPN'],
        ['INTERNET', 'Internet'],
      ],
    },
    {
      code: 'ACCESS',
      name: 'Accounts & Access',
      subs: [
        ['PASSWORD', 'Password'],
        ['PERMS', 'Permissions'],
      ],
    },
  ];
  for (const cat of categorySeed) {
    const saved = await prisma.category.upsert({
      where: { code: cat.code },
      update: { name: cat.name, isActive: true, deletedAt: null },
      create: { code: cat.code, name: cat.name },
    });
    for (const [code, name] of cat.subs) {
      const existing = await prisma.subcategory.findFirst({
        where: { categoryId: saved.id, code },
      });
      if (existing) {
        await prisma.subcategory.update({
          where: { id: existing.id },
          data: { name, isActive: true, deletedAt: null },
        });
      } else {
        await prisma.subcategory.create({
          data: { categoryId: saved.id, code, name },
        });
      }
    }
  }

  // Phase 5 — business hours + default SLA
  for (const day of [1, 2, 3, 4, 5]) {
    await prisma.businessHours.upsert({
      where: {
        dayOfWeek_startTime_endTime: {
          dayOfWeek: day,
          startTime: '08:00',
          endTime: '17:00',
        },
      },
      update: { isActive: true, timezone: 'Africa/Accra' },
      create: {
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '17:00',
        timezone: 'Africa/Accra',
      },
    });
  }

  const defaultSla = await prisma.slaPolicy.findFirst({
    where: { name: 'Standard IT Support' },
  });
  const sla =
    defaultSla ??
    (await prisma.slaPolicy.create({
      data: {
        name: 'Standard IT Support',
        firstResponseMinutes: 60,
        resolveMinutes: 480,
        escalations: {
          create: [
            { thresholdPercent: 75, notifyRoleCodes: 'agent' },
            { thresholdPercent: 90, notifyRoleCodes: 'agent,it_manager' },
            { thresholdPercent: 100, notifyRoleCodes: 'it_manager,sysadmin' },
            { thresholdPercent: 120, notifyRoleCodes: 'sysadmin' },
          ],
        },
      },
    }));
  void sla;

  // Phase 6 — assignment Network → Service Desk
  const networkCat = await prisma.category.findUnique({
    where: { code: 'NETWORK' },
  });
  if (networkCat) {
    const existingRule = await prisma.assignmentRule.findFirst({
      where: { name: 'Network to Service Desk' },
    });
    if (!existingRule) {
      await prisma.assignmentRule.create({
        data: {
          name: 'Network to Service Desk',
          categoryId: networkCat.id,
          teamId: serviceDesk.id,
          priority: 10,
        },
      });
    }
  }

  // Phase 8 — knowledge + catalog
  await prisma.knowledgeArticle.upsert({
    where: { slug: 'reset-password-m365' },
    update: {
      title: 'Reset Microsoft 365 password',
      body: '1. Go to portal.office.com\n2. Click Forgot password\n3. Follow the prompts.\nIf locked out, raise an Access Request in LogIT.',
      status: 'published',
      publishedAt: new Date(),
      category: 'Accounts',
    },
    create: {
      slug: 'reset-password-m365',
      title: 'Reset Microsoft 365 password',
      body: '1. Go to portal.office.com\n2. Click Forgot password\n3. Follow the prompts.\nIf locked out, raise an Access Request in LogIT.',
      status: 'published',
      publishedAt: new Date(),
      category: 'Accounts',
      createdById: admin.id,
    },
  });

  await prisma.serviceCatalogItem.upsert({
    where: { code: 'REQ-LAPTOP' },
    update: {
      name: 'Request Laptop',
      description: 'Standard corporate laptop for a new or existing employee.',
      ticketTypeCode: 'service_request',
      categoryCode: 'HARDWARE',
      teamId: serviceDesk.id,
      isActive: true,
    },
    create: {
      code: 'REQ-LAPTOP',
      name: 'Request Laptop',
      description: 'Standard corporate laptop for a new or existing employee.',
      ticketTypeCode: 'service_request',
      categoryCode: 'HARDWARE',
      teamId: serviceDesk.id,
    },
  });

  // Phase 9 — assets
  const laptopType = await prisma.assetType.upsert({
    where: { code: 'LAPTOP' },
    update: { name: 'Laptop' },
    create: { code: 'LAPTOP', name: 'Laptop' },
  });
  await prisma.asset.upsert({
    where: { assetTag: 'GH-IT-0001' },
    update: { status: 'in_use', assignedUserId: employee.id },
    create: {
      assetTag: 'GH-IT-0001',
      typeId: laptopType.id,
      serialNumber: 'SN-DEMO-001',
      manufacturer: 'Dell',
      model: 'Latitude 5540',
      status: 'in_use',
      assignedUserId: employee.id,
    },
  });

  console.log('LogIT seed complete (Phase 1–11 MVP).');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log('Employee: employee@logit.local / LogIT-Employee-2026!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
