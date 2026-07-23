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
      PERMISSIONS.APPROVALS_READ,
      PERMISSIONS.APPROVALS_DECIDE,
    ],
  },
  {
    code: ROLES.APPROVER,
    name: 'Department Manager / Approver',
    description: 'Approves service requests',
    permissions: [
      PERMISSIONS.TICKETS_READ_OWN,
      PERMISSIONS.KNOWLEDGE_READ,
      PERMISSIONS.APPROVALS_READ,
      PERMISSIONS.APPROVALS_DECIDE,
    ],
  },
  {
    code: ROLES.SYSADMIN,
    name: 'Administrator',
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

    // Keep role grants aligned with ROLE_DEFS (drop extras from earlier experiments).
    const allowed = new Set<string>(role.permissions);
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: saved.id },
      include: { permission: true },
    });
    for (const row of existing) {
      if (!allowed.has(row.permission.code)) {
        await prisma.rolePermission.delete({
          where: {
            roleId_permissionId: {
              roleId: saved.id,
              permissionId: row.permissionId,
            },
          },
        });
      }
    }
  }

  const hq = await prisma.location.upsert({
    where: { code: 'HQ-ACC' },
    update: {
      name: 'Head Office — Accra',
      country: 'GH',
      site: 'Accra HQ',
      timezone: 'Africa/Accra',
      isActive: true,
      deletedAt: null,
    },
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

  const opsDept = await prisma.department.upsert({
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
    update: {
      passwordHash: demoHash,
      isActive: true,
      deletedAt: null,
      locationId: hq.id,
    },
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

  // Demo users for every role (dev / staging only)
  const roleByCode = async (code: string) =>
    prisma.role.findUniqueOrThrow({ where: { code } });

  const upsertDemoUser = async (opts: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roleCode: string;
    departmentId?: string | null;
    joinServiceDesk?: boolean;
    isLead?: boolean;
  }) => {
    const role = await roleByCode(opts.roleCode);
    const hash = await argon2.hash(opts.password, { type: argon2.argon2id });
    const user = await prisma.user.upsert({
      where: { email: opts.email.toLowerCase() },
      update: {
        passwordHash: hash,
        firstName: opts.firstName,
        lastName: opts.lastName,
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        departmentId: opts.departmentId ?? null,
        locationId: hq.id,
      },
      create: {
        email: opts.email.toLowerCase(),
        firstName: opts.firstName,
        lastName: opts.lastName,
        passwordHash: hash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        departmentId: opts.departmentId ?? null,
        locationId: hq.id,
        roles: { create: [{ roleId: role.id }] },
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    if (opts.joinServiceDesk) {
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: { teamId: serviceDesk.id, userId: user.id },
        },
        update: { isLead: opts.isLead ?? false },
        create: {
          teamId: serviceDesk.id,
          userId: user.id,
          isLead: opts.isLead ?? false,
        },
      });
    }
    return user;
  };

  const agent = await upsertDemoUser({
    email: 'agent@logit.local',
    password: 'LogIT-Agent-2026!',
    firstName: 'Kojo',
    lastName: 'Asante',
    roleCode: ROLES.AGENT,
    departmentId: itDept.id,
    joinServiceDesk: true,
  });
  const senior = await upsertDemoUser({
    email: 'senior@logit.local',
    password: 'LogIT-Senior-2026!',
    firstName: 'Efua',
    lastName: 'Boateng',
    roleCode: ROLES.SENIOR_AGENT,
    departmentId: itDept.id,
    joinServiceDesk: true,
  });
  const manager = await upsertDemoUser({
    email: 'manager@logit.local',
    password: 'LogIT-Manager-2026!',
    firstName: 'Yaw',
    lastName: 'Osei',
    roleCode: ROLES.IT_MANAGER,
    departmentId: itDept.id,
    joinServiceDesk: true,
    isLead: true,
  });
  const approver = await upsertDemoUser({
    email: 'approver@logit.local',
    password: 'LogIT-Approver-2026!',
    firstName: 'Akosua',
    lastName: 'Addo',
    roleCode: ROLES.APPROVER,
    departmentId: opsDept.id,
  });
  const auditor = await upsertDemoUser({
    email: 'auditor@logit.local',
    password: 'LogIT-Auditor-2026!',
    firstName: 'Nana',
    lastName: 'Owusu',
    roleCode: ROLES.AUDITOR,
    departmentId: itDept.id,
  });
  void auditor;

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
    {
      code: 'under_investigation',
      name: 'Under investigation',
      sortOrder: 45,
    },
    {
      code: 'scheduled',
      name: 'Scheduled',
      sortOrder: 48,
      pausesSla: true,
    },
    {
      code: 'implementing',
      name: 'Implementing',
      sortOrder: 49,
    },
    { code: 'pending_user', name: 'Pending User', sortOrder: 50, pausesSla: true },
    {
      code: 'known_error',
      name: 'Known error',
      sortOrder: 55,
      pausesSla: true,
    },
    { code: 'pending_vendor', name: 'Pending Vendor', sortOrder: 60, pausesSla: true },
    { code: 'pending_approval', name: 'Pending Approval', sortOrder: 70, pausesSla: true },
    { code: 'on_hold', name: 'On Hold', sortOrder: 80, pausesSla: true },
    { code: 'resolved', name: 'Resolved', sortOrder: 90 },
    { code: 'closed', name: 'Closed', sortOrder: 100, isTerminal: true },
    { code: 'cancelled', name: 'Cancelled', sortOrder: 110, isTerminal: true },
    { code: 'merged', name: 'Merged', sortOrder: 120, isTerminal: true },
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
    ['new', 'pending_approval'],
    ['new', 'cancelled'],
    ['open', 'assigned'],
    ['open', 'in_progress'],
    ['open', 'cancelled'],
    ['assigned', 'in_progress'],
    ['assigned', 'under_investigation'],
    ['assigned', 'pending_user'],
    ['in_progress', 'pending_user'],
    ['in_progress', 'pending_vendor'],
    ['in_progress', 'pending_approval'],
    ['in_progress', 'on_hold'],
    ['in_progress', 'under_investigation'],
    ['in_progress', 'resolved'],
    ['under_investigation', 'known_error'],
    ['under_investigation', 'in_progress'],
    ['under_investigation', 'resolved'],
    ['under_investigation', 'on_hold'],
    ['known_error', 'in_progress'],
    ['known_error', 'under_investigation'],
    ['known_error', 'resolved'],
    ['new', 'pending_approval'],
    ['open', 'pending_approval'],
    ['assigned', 'pending_approval'],
    ['in_progress', 'pending_approval'],
    ['pending_approval', 'scheduled'],
    ['open', 'scheduled'],
    ['assigned', 'scheduled'],
    ['in_progress', 'scheduled'],
    ['in_progress', 'implementing'],
    ['scheduled', 'implementing'],
    ['scheduled', 'cancelled'],
    ['scheduled', 'on_hold'],
    ['implementing', 'resolved'],
    ['implementing', 'on_hold'],
    ['implementing', 'scheduled'],
    ['on_hold', 'scheduled'],
    ['on_hold', 'implementing'],
    ['pending_user', 'in_progress'],
    ['pending_vendor', 'in_progress'],
    ['pending_approval', 'open'],
    ['pending_approval', 'in_progress'],
    ['pending_approval', 'cancelled'],
    ['on_hold', 'in_progress'],
    ['on_hold', 'under_investigation'],
    ['open', 'under_investigation'],
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

  // Phase 6 — skills + assignment Network → Service Desk (auto-assign)
  const skillDefs = [
    {
      code: 'NETWORK',
      name: 'Networking',
      description: 'LAN/WAN, VPN, firewall, Wi-Fi',
    },
    {
      code: 'ENDPOINT',
      name: 'Endpoint support',
      description: 'Laptops, desktops, peripherals',
    },
    {
      code: 'IDENTITY',
      name: 'Identity & access',
      description: 'Accounts, MFA, SSO, AD/Entra',
    },
  ];
  const skillsByCode: Record<string, { id: string }> = {};
  for (const s of skillDefs) {
    const skill = await prisma.skill.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        description: s.description,
        isActive: true,
      },
      create: s,
    });
    skillsByCode[s.code] = skill;
  }

  // Agent: network + endpoint; Senior: all three; Manager: identity lead
  for (const [user, codes] of [
    [agent, ['NETWORK', 'ENDPOINT']],
    [senior, ['NETWORK', 'ENDPOINT', 'IDENTITY']],
    [manager, ['IDENTITY', 'NETWORK']],
  ] as const) {
    for (const code of codes) {
      const skill = skillsByCode[code];
      if (!skill) continue;
      await prisma.userSkill.upsert({
        where: {
          userId_skillId: { userId: user.id, skillId: skill.id },
        },
        update: {},
        create: { userId: user.id, skillId: skill.id },
      });
    }
  }

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
          skillId: skillsByCode.NETWORK?.id,
          autoAssignAssignee: true,
          priority: 10,
        },
      });
    } else {
      await prisma.assignmentRule.update({
        where: { id: existingRule.id },
        data: {
          skillId: skillsByCode.NETWORK?.id ?? existingRule.skillId,
          autoAssignAssignee: true,
          isActive: true,
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

  const laptopFormSchema = [
    {
      name: 'justification',
      label: 'Business justification',
      type: 'textarea',
      required: true,
      placeholder: 'Why is a laptop needed?',
    },
    {
      name: 'neededBy',
      label: 'Needed by',
      type: 'text',
      required: true,
      placeholder: 'YYYY-MM-DD',
      helpText: 'Target date for delivery',
    },
    {
      name: 'formFactor',
      label: 'Form factor',
      type: 'select',
      required: true,
      options: [
        { value: 'laptop_14', label: '14" laptop' },
        { value: 'laptop_16', label: '16" laptop' },
        { value: 'ultrabook', label: 'Ultrabook' },
      ],
      defaultValue: 'laptop_14',
    },
    {
      name: 'quantity',
      label: 'Quantity',
      type: 'number',
      required: true,
      min: 1,
      max: 10,
      defaultValue: 1,
    },
    {
      name: 'remoteSetup',
      label: 'Remote setup required',
      type: 'checkbox',
      helpText: 'Ship and configure for remote / WFH use',
    },
  ];

  await prisma.serviceCatalogItem.upsert({
    where: { code: 'REQ-LAPTOP' },
    update: {
      name: 'Request Laptop',
      description: 'Standard corporate laptop for a new or existing employee.',
      ticketTypeCode: 'service_request',
      categoryCode: 'HARDWARE',
      teamId: serviceDesk.id,
      formSchema: laptopFormSchema,
      isActive: true,
    },
    create: {
      code: 'REQ-LAPTOP',
      name: 'Request Laptop',
      description: 'Standard corporate laptop for a new or existing employee.',
      ticketTypeCode: 'service_request',
      categoryCode: 'HARDWARE',
      teamId: serviceDesk.id,
      formSchema: laptopFormSchema,
    },
  });

  // Phase 9 — assets
  const assetTypeDefs = [
    { code: 'LAPTOP', name: 'Laptop' },
    { code: 'DESKTOP', name: 'Desktop' },
    { code: 'MONITOR', name: 'Monitor' },
    { code: 'PHONE', name: 'Mobile phone' },
    { code: 'TABLET', name: 'Tablet' },
    { code: 'SERVER', name: 'Server' },
    { code: 'NETWORK', name: 'Network device' },
    { code: 'PERIPHERAL', name: 'Peripheral' },
  ] as const;
  for (const t of assetTypeDefs) {
    await prisma.assetType.upsert({
      where: { code: t.code },
      update: { name: t.name },
      create: { code: t.code, name: t.name },
    });
  }
  const laptopType = await prisma.assetType.findUniqueOrThrow({
    where: { code: 'LAPTOP' },
  });
  const hqLocation = await prisma.location.findFirst({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });
  await prisma.asset.upsert({
    where: { assetTag: 'GH-IT-0001' },
    update: {
      status: 'in_service',
      assignedUserId: employee.id,
      name: 'Demo Latitude laptop',
      locationId: hqLocation?.id ?? null,
      notes: 'Seed demo asset for the register.',
    },
    create: {
      assetTag: 'GH-IT-0001',
      name: 'Demo Latitude laptop',
      typeId: laptopType.id,
      serialNumber: 'SN-DEMO-001',
      manufacturer: 'Dell',
      model: 'Latitude 5540',
      status: 'in_service',
      assignedUserId: employee.id,
      locationId: hqLocation?.id ?? null,
      notes: 'Seed demo asset for the register.',
    },
  });
  await prisma.asset.upsert({
    where: { assetTag: 'GH-IT-0002' },
    update: {
      status: 'in_stock',
      name: 'Spare docking station',
      locationId: hqLocation?.id ?? null,
    },
    create: {
      assetTag: 'GH-IT-0002',
      name: 'Spare docking station',
      typeId: (
        await prisma.assetType.findUniqueOrThrow({
          where: { code: 'PERIPHERAL' },
        })
      ).id,
      serialNumber: 'SN-DOCK-002',
      manufacturer: 'Dell',
      model: 'WD19TB',
      status: 'in_stock',
      locationId: hqLocation?.id ?? null,
      notes: 'Hot-spare dock for laptop users.',
    },
  });

  const serverType = await prisma.assetType.findUniqueOrThrow({
    where: { code: 'SERVER' },
  });
  const networkType = await prisma.assetType.findUniqueOrThrow({
    where: { code: 'NETWORK' },
  });
  await prisma.asset.upsert({
    where: { assetTag: 'GH-SRV-0001' },
    update: {
      status: 'in_service',
      name: 'App server 01',
      locationId: hqLocation?.id ?? null,
      source: 'manual',
    },
    create: {
      assetTag: 'GH-SRV-0001',
      name: 'App server 01',
      typeId: serverType.id,
      serialNumber: 'SN-SRV-001',
      manufacturer: 'Dell',
      model: 'PowerEdge R750',
      status: 'in_service',
      locationId: hqLocation?.id ?? null,
      notes: 'Seed CMDB server CI.',
      source: 'manual',
    },
  });
  await prisma.asset.upsert({
    where: { assetTag: 'GH-NET-0001' },
    update: {
      status: 'in_service',
      name: 'Core switch Accra',
      locationId: hqLocation?.id ?? null,
      source: 'manual',
    },
    create: {
      assetTag: 'GH-NET-0001',
      name: 'Core switch Accra',
      typeId: networkType.id,
      serialNumber: 'SN-SW-001',
      manufacturer: 'Cisco',
      model: 'Catalyst 9300',
      status: 'in_service',
      locationId: hqLocation?.id ?? null,
      notes: 'Seed CMDB network CI.',
      source: 'manual',
    },
  });

  const laptopCi = await prisma.asset.findUniqueOrThrow({
    where: { assetTag: 'GH-IT-0001' },
  });
  const dockCi = await prisma.asset.findUniqueOrThrow({
    where: { assetTag: 'GH-IT-0002' },
  });
  const serverCi = await prisma.asset.findUniqueOrThrow({
    where: { assetTag: 'GH-SRV-0001' },
  });
  const switchCi = await prisma.asset.findUniqueOrThrow({
    where: { assetTag: 'GH-NET-0001' },
  });
  for (const rel of [
    {
      fromAssetId: laptopCi.id,
      toAssetId: dockCi.id,
      relationType: 'uses',
      notes: 'Laptop uses docking station',
    },
    {
      fromAssetId: serverCi.id,
      toAssetId: switchCi.id,
      relationType: 'connected_to',
      notes: 'Server uplink to core switch',
    },
    {
      fromAssetId: laptopCi.id,
      toAssetId: switchCi.id,
      relationType: 'depends_on',
      notes: 'Endpoint depends on access network',
    },
  ] as const) {
    await prisma.assetRelation.upsert({
      where: {
        fromAssetId_toAssetId_relationType: {
          fromAssetId: rel.fromAssetId,
          toAssetId: rel.toAssetId,
          relationType: rel.relationType,
        },
      },
      update: { notes: rel.notes },
      create: rel,
    });
  }

  // ─── Demo sample data (idempotent by ticket number / slug / tag) ───
  const year = new Date().getFullYear();
  const types = await prisma.ticketType.findMany();
  const typeByCode = Object.fromEntries(types.map((t) => [t.code, t]));
  const cats = await prisma.category.findMany({
    include: { subcategories: true },
  });
  const catByCode = Object.fromEntries(cats.map((c) => [c.code, c]));
  const statusesNow = await prisma.ticketStatus.findMany();
  const statusByCode = Object.fromEntries(statusesNow.map((s) => [s.code, s]));
  const prios = await prisma.priority.findMany();
  const prioByCode = Object.fromEntries(prios.map((p) => [p.code, p]));

  async function upsertTicket(opts: {
    number: string;
    title: string;
    description: string;
    typeCode: string;
    statusCode: string;
    priorityCode?: string;
    categoryCode?: string;
    requesterId: string;
    assigneeId?: string | null;
    teamId?: string | null;
    majorIncident?: boolean;
    parentNumber?: string;
    rootCause?: string;
    workaround?: string;
    changeRisk?: string;
    changePlan?: string;
    rollbackPlan?: string;
    scheduledStart?: Date;
    scheduledEnd?: Date;
    cabRequired?: boolean;
    impact?: string;
    urgency?: string;
    dueAt?: Date;
    resolvedAt?: Date;
    channel?: string;
    channelMeta?: Record<string, unknown>;
  }) {
    const type = typeByCode[opts.typeCode];
    const status = statusByCode[opts.statusCode];
    if (!type || !status) return null;
    const category = opts.categoryCode ? catByCode[opts.categoryCode] : null;
    const priority = opts.priorityCode ? prioByCode[opts.priorityCode] : null;
    let parentId: string | undefined;
    if (opts.parentNumber) {
      const parent = await prisma.ticket.findUnique({
        where: { number: opts.parentNumber },
        select: { id: true },
      });
      parentId = parent?.id;
    }
    const data = {
      title: opts.title,
      description: opts.description,
      typeId: type.id,
      statusId: status.id,
      priorityId: priority?.id ?? null,
      categoryId: category?.id ?? null,
      impact: opts.impact ?? null,
      urgency: opts.urgency ?? null,
      requesterId: opts.requesterId,
      assigneeId: opts.assigneeId ?? null,
      teamId: opts.teamId ?? serviceDesk.id,
      departmentId: itDept.id,
      locationId: hq.id,
      parentId: parentId ?? null,
      majorIncident: opts.majorIncident ?? false,
      channel: opts.channel ?? 'web',
      channelMeta: opts.channelMeta ?? undefined,
      rootCause: opts.rootCause ?? null,
      workaround: opts.workaround ?? null,
      changeRisk: opts.changeRisk ?? null,
      changePlan: opts.changePlan ?? null,
      rollbackPlan: opts.rollbackPlan ?? null,
      scheduledStart: opts.scheduledStart ?? null,
      scheduledEnd: opts.scheduledEnd ?? null,
      cabRequired: opts.cabRequired ?? opts.typeCode === 'change',
      dueAt: opts.dueAt ?? null,
      resolvedAt: opts.resolvedAt ?? null,
    };
    return prisma.ticket.upsert({
      where: { number: opts.number },
      update: data,
      create: { number: opts.number, ...data },
    });
  }

  const now = Date.now();
  const hours = (h: number) => new Date(now + h * 3600_000);
  const daysAgo = (d: number) => new Date(now - d * 86400_000);

  // Sync number sequences so UI-created tickets don't collide
  for (const [prefix, lastValue] of [
    ['INC', 20],
    ['REQ', 10],
    ['ACC', 5],
    ['SEC', 3],
    ['PRB', 5],
    ['CHG', 5],
    ['TSK', 5],
  ] as const) {
    await prisma.ticketNumberSequence.upsert({
      where: { prefix_year: { prefix, year } },
      update: { lastValue },
      create: { prefix, year, lastValue },
    });
  }

  const miCore = await upsertTicket({
    number: `INC-${year}-000001`,
    title: 'Email outage — Exchange Online unreachable',
    description:
      'Users across HQ cannot send or receive mail. Outlook shows disconnected. Started ~08:15. Business-critical.',
    typeCode: 'incident',
    statusCode: 'in_progress',
    priorityCode: 'p1_critical',
    categoryCode: 'SOFTWARE',
    requesterId: manager.id,
    assigneeId: manager.id,
    majorIncident: true,
    impact: 'high',
    urgency: 'high',
    dueAt: hours(2),
    channel: 'email',
    channelMeta: { messageId: 'seed-mi-email@logit.local', from: 'noc@example.com' },
  });

  await upsertTicket({
    number: `INC-${year}-000002`,
    title: 'Related: Outlook desktop stuck on password prompt',
    description: 'Child of major email outage — clients prompting repeatedly.',
    typeCode: 'incident',
    statusCode: 'assigned',
    priorityCode: 'p2_high',
    categoryCode: 'SOFTWARE',
    requesterId: agent.id,
    assigneeId: agent.id,
    parentNumber: `INC-${year}-000001`,
    impact: 'medium',
    urgency: 'high',
  });

  await upsertTicket({
    number: `INC-${year}-000003`,
    title: 'VPN disconnects every 10 minutes',
    description:
      'GlobalProtect drops sessions for remote staff. Reconnect works briefly.',
    typeCode: 'incident',
    statusCode: 'assigned',
    priorityCode: 'p2_high',
    categoryCode: 'NETWORK',
    requesterId: employee.id,
    assigneeId: agent.id,
    impact: 'medium',
    urgency: 'high',
    dueAt: hours(8),
    channel: 'slack',
    channelMeta: { slackChannelId: 'C-SEED-VPN', slackUserId: 'U-SEED' },
  });

  await upsertTicket({
    number: `INC-${year}-000004`,
    title: 'Printer on Floor 3 offline',
    description: 'HP LaserJet near finance shows offline; queue backing up.',
    typeCode: 'incident',
    statusCode: 'new',
    priorityCode: 'p3_medium',
    categoryCode: 'HARDWARE',
    requesterId: employee.id,
    assigneeId: null,
    impact: 'low',
    urgency: 'medium',
    channel: 'teams',
    channelMeta: { conversationId: 'seed-teams-printer' },
  });

  await upsertTicket({
    number: `INC-${year}-000005`,
    title: 'Wi-Fi slow in conference wing',
    description: 'Guests and staff report <5 Mbps on conf-A SSID.',
    typeCode: 'incident',
    statusCode: 'pending_vendor',
    priorityCode: 'p3_medium',
    categoryCode: 'NETWORK',
    requesterId: employee.id,
    assigneeId: senior.id,
    impact: 'medium',
    urgency: 'medium',
  });

  await upsertTicket({
    number: `INC-${year}-000006`,
    title: 'Major: Core switch stack reboot loop (resolved)',
    description: 'Datacenter ToR stack flapped; traffic blackholed for 40m.',
    typeCode: 'incident',
    statusCode: 'resolved',
    priorityCode: 'p1_critical',
    categoryCode: 'NETWORK',
    requesterId: manager.id,
    assigneeId: senior.id,
    majorIncident: true,
    impact: 'high',
    urgency: 'high',
    resolvedAt: daysAgo(2),
  });

  await upsertTicket({
    number: `SEC-${year}-000001`,
    title: 'Suspicious login attempts on shared mailbox',
    description: 'Impossible travel alerts for finance@ — review MFA and sessions.',
    typeCode: 'security_incident',
    statusCode: 'under_investigation',
    priorityCode: 'p2_high',
    categoryCode: 'ACCESS',
    requesterId: manager.id,
    assigneeId: senior.id,
    impact: 'high',
    urgency: 'medium',
  });

  const reqLaptop = await upsertTicket({
    number: `REQ-${year}-000001`,
    title: 'Request laptop for new hire — Ops',
    description: 'New starter needs a standard corporate laptop by Monday.',
    typeCode: 'service_request',
    statusCode: 'pending_approval',
    priorityCode: 'p3_medium',
    categoryCode: 'HARDWARE',
    requesterId: employee.id,
    assigneeId: null,
    impact: 'low',
    urgency: 'medium',
  });

  await upsertTicket({
    number: `REQ-${year}-000002`,
    title: 'Extra monitor for design workstation',
    description: '27" IPS monitor for dual-screen setup.',
    typeCode: 'service_request',
    statusCode: 'open',
    priorityCode: 'p4_low',
    categoryCode: 'HARDWARE',
    requesterId: employee.id,
    assigneeId: agent.id,
  });

  await upsertTicket({
    number: `ACC-${year}-000001`,
    title: 'Access to Finance SharePoint site',
    description: 'Need Contributor on Finance FY26 site collection.',
    typeCode: 'access_request',
    statusCode: 'pending_approval',
    priorityCode: 'p3_medium',
    categoryCode: 'ACCESS',
    requesterId: employee.id,
  });

  const problem = await upsertTicket({
    number: `PRB-${year}-000001`,
    title: 'Problem: Recurring VPN disconnects',
    description:
      'Raised from multiple VPN incidents. Investigating gateway config and client version skew.',
    typeCode: 'problem',
    statusCode: 'under_investigation',
    priorityCode: 'p2_high',
    categoryCode: 'NETWORK',
    requesterId: manager.id,
    assigneeId: senior.id,
    rootCause: 'Suspected mismatched GlobalProtect client vs portal config.',
    workaround: 'Reconnect via Always-On fallback profile; avoid split tunnel on LTE.',
  });

  await upsertTicket({
    number: `INC-${year}-000007`,
    title: 'VPN drop — linked to PRB-000001',
    description: 'Another occurrence; linked under problem record.',
    typeCode: 'incident',
    statusCode: 'open',
    priorityCode: 'p2_high',
    categoryCode: 'NETWORK',
    requesterId: employee.id,
    assigneeId: agent.id,
    parentNumber: `PRB-${year}-000001`,
  });

  await upsertTicket({
    number: `PRB-${year}-000002`,
    title: 'Problem: Known error — Outlook search index corruption',
    description: 'Search returns incomplete results after Windows updates.',
    typeCode: 'problem',
    statusCode: 'known_error',
    priorityCode: 'p3_medium',
    categoryCode: 'SOFTWARE',
    requesterId: senior.id,
    assigneeId: senior.id,
    rootCause: 'Windows Search indexer fails after cumulative update KB503xxx.',
    workaround: 'Rebuild index via Outlook /cleansearch; defer optional CU.',
  });

  await upsertTicket({
    number: `CHG-${year}-000001`,
    title: 'Change: Upgrade firewall firmware to 7.2.8',
    description: 'Maintenance window Sunday 02:00–04:00. Dual HA pair.',
    typeCode: 'change',
    statusCode: 'pending_approval',
    priorityCode: 'p2_high',
    categoryCode: 'NETWORK',
    requesterId: senior.id,
    assigneeId: manager.id,
    changeRisk: 'medium — brief failover expected',
    changePlan:
      '1. Snapshot config\n2. Upgrade passive\n3. Failover\n4. Upgrade former active\n5. Validate VPN + WAN',
    rollbackPlan: 'Revert to previous firmware image on both nodes; restore snapshot.',
    scheduledStart: hours(72),
    scheduledEnd: hours(74),
    cabRequired: true,
  });

  await upsertTicket({
    number: `CHG-${year}-000002`,
    title: 'Change: Deploy M365 Conditional Access pilot',
    description: 'Pilot CA policy for IT dept only.',
    typeCode: 'change',
    statusCode: 'scheduled',
    priorityCode: 'p3_medium',
    categoryCode: 'ACCESS',
    requesterId: manager.id,
    assigneeId: senior.id,
    changeRisk: 'low',
    changePlan: 'Enable report-only → enforce for IT security group.',
    rollbackPlan: 'Disable policy; clear what-if reports.',
    scheduledStart: hours(48),
    scheduledEnd: hours(50),
    cabRequired: true,
  });

  await upsertTicket({
    number: `CHG-${year}-000003`,
    title: 'Change: Replace Floor 2 access point',
    description: 'Swap faulty AP-214 with spare.',
    typeCode: 'change',
    statusCode: 'implementing',
    priorityCode: 'p4_low',
    categoryCode: 'NETWORK',
    requesterId: agent.id,
    assigneeId: agent.id,
    changeRisk: 'low',
    changePlan: 'Take AP offline, mount spare, adopt in controller.',
    rollbackPlan: 'Re-seat original AP.',
    scheduledStart: hours(-1),
    scheduledEnd: hours(1),
  });

  // M3 — approval policies (multi-step)
  const reqType = await prisma.ticketType.findUnique({
    where: { code: 'service_request' },
  });
  const accType = await prisma.ticketType.findUnique({
    where: { code: 'access_request' },
  });
  const chgType = await prisma.ticketType.findUnique({
    where: { code: 'change' },
  });

  let reqPolicy = await prisma.approvalPolicy.findFirst({
    where: { name: 'Service / access — single approver' },
    include: { steps: true },
  });
  if (!reqPolicy && reqType) {
    reqPolicy = await prisma.approvalPolicy.create({
      data: {
        name: 'Service / access — single approver',
        ticketTypeId: reqType.id,
        priority: 20,
        steps: {
          create: [
            {
              stepOrder: 1,
              name: 'Business approver',
              approverRoleCode: ROLES.APPROVER,
              mode: 'any',
            },
          ],
        },
      },
      include: { steps: true },
    });
  }
  // Mirror for access requests if a separate policy is useful
  let accPolicy = await prisma.approvalPolicy.findFirst({
    where: { name: 'Access request — single approver' },
    include: { steps: true },
  });
  if (!accPolicy && accType) {
    accPolicy = await prisma.approvalPolicy.create({
      data: {
        name: 'Access request — single approver',
        ticketTypeId: accType.id,
        priority: 20,
        steps: {
          create: [
            {
              stepOrder: 1,
              name: 'Access owner',
              approverRoleCode: ROLES.APPROVER,
              mode: 'any',
            },
          ],
        },
      },
      include: { steps: true },
    });
  }

  let cabPolicy = await prisma.approvalPolicy.findFirst({
    where: { name: 'Change CAB — manager then approver' },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });
  if (!cabPolicy && chgType) {
    cabPolicy = await prisma.approvalPolicy.create({
      data: {
        name: 'Change CAB — manager then approver',
        ticketTypeId: chgType.id,
        priority: 10,
        steps: {
          create: [
            {
              stepOrder: 1,
              name: 'IT Manager review',
              approverRoleCode: ROLES.IT_MANAGER,
              mode: 'any',
            },
            {
              stepOrder: 2,
              name: 'CAB / business approver',
              approverRoleCode: ROLES.APPROVER,
              mode: 'any',
            },
          ],
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  // Approvals for pending items (only current step pending)
  if (reqLaptop && reqPolicy?.steps[0]) {
    const step = reqPolicy.steps[0];
    await prisma.approval.deleteMany({ where: { ticketId: reqLaptop.id } });
    await prisma.approval.create({
      data: {
        ticketId: reqLaptop.id,
        approverId: approver.id,
        policyId: reqPolicy.id,
        stepId: step.id,
        stepOrder: step.stepOrder,
        status: 'pending',
      },
    });
  }
  const acc = await prisma.ticket.findUnique({
    where: { number: `ACC-${year}-000001` },
  });
  if (acc && (accPolicy ?? reqPolicy)?.steps[0]) {
    const policy = accPolicy ?? reqPolicy!;
    const step = policy.steps[0];
    await prisma.approval.deleteMany({ where: { ticketId: acc.id } });
    await prisma.approval.create({
      data: {
        ticketId: acc.id,
        approverId: approver.id,
        policyId: policy.id,
        stepId: step.id,
        stepOrder: step.stepOrder,
        status: 'pending',
      },
    });
  }
  const chgCab = await prisma.ticket.findUnique({
    where: { number: `CHG-${year}-000001` },
  });
  if (chgCab && cabPolicy?.steps[0]) {
    const step1 = cabPolicy.steps[0];
    await prisma.approval.deleteMany({ where: { ticketId: chgCab.id } });
    // Only step 1 is active; manager must approve before approver sees step 2.
    await prisma.approval.create({
      data: {
        ticketId: chgCab.id,
        approverId: manager.id,
        policyId: cabPolicy.id,
        stepId: step1.id,
        stepOrder: step1.stepOrder,
        status: 'pending',
      },
    });
  }

  // Activity on major incident
  if (miCore) {
    await prisma.ticketComment.deleteMany({ where: { ticketId: miCore.id } });
    await prisma.ticketComment.createMany({
      data: [
        {
          ticketId: miCore.id,
          authorId: employee.id,
          body: 'Entire floor cannot send mail. Finance month-end at risk.',
          isInternal: false,
        },
        {
          ticketId: miCore.id,
          authorId: manager.id,
          body: 'Declared major. Bridge open on Teams — war room channel #mi-email.',
          isInternal: true,
        },
        {
          ticketId: miCore.id,
          authorId: senior.id,
          body: 'Microsoft 365 service health shows advisory; checking our connector.',
          isInternal: false,
        },
      ],
    });
    await prisma.ticketHistory.deleteMany({
      where: { ticketId: miCore.id, field: { in: ['created', 'assignee', 'status', 'major_incident'] } },
    });
    await prisma.ticketHistory.createMany({
      data: [
        {
          ticketId: miCore.id,
          actorId: employee.id,
          field: 'created',
          newValue: miCore.number,
        },
        {
          ticketId: miCore.id,
          actorId: manager.id,
          field: 'major_incident',
          oldValue: 'false',
          newValue: 'true',
        },
        {
          ticketId: miCore.id,
          actorId: manager.id,
          field: 'assignee',
          oldValue: null,
          newValue: manager.id,
        },
        {
          ticketId: miCore.id,
          actorId: manager.id,
          field: 'status',
          oldValue: 'new',
          newValue: 'in_progress',
        },
      ],
    });
    await prisma.ticketWatcher.upsert({
      where: {
        ticketId_userId: { ticketId: miCore.id, userId: agent.id },
      },
      update: {},
      create: { ticketId: miCore.id, userId: agent.id },
    });
    await prisma.ticketWatcher.upsert({
      where: {
        ticketId_userId: { ticketId: miCore.id, userId: senior.id },
      },
      update: {},
      create: { ticketId: miCore.id, userId: senior.id },
    });
    await prisma.ticketWorkLog.deleteMany({ where: { ticketId: miCore.id } });
    await prisma.ticketWorkLog.create({
      data: {
        ticketId: miCore.id,
        authorId: senior.id,
        minutes: 45,
        note: 'Initial triage + M365 health + connector checks',
      },
    });
  }

  if (problem) {
    await prisma.ticketComment.deleteMany({ where: { ticketId: problem.id } });
    await prisma.ticketComment.create({
      data: {
        ticketId: problem.id,
        authorId: senior.id,
        body: 'Correlating three VPN incidents from last week; opening known-error if confirmed.',
        isInternal: true,
      },
    });
  }

  // Extra knowledge + catalog + assets
  await prisma.knowledgeArticle.upsert({
    where: { slug: 'connect-corporate-vpn' },
    update: {
      title: 'Connect to corporate VPN',
      body: '<p>Install GlobalProtect, sign in with your LogIT email, and choose the <strong>HQ</strong> portal.</p><p>If sessions drop, see the VPN known error article or raise an incident.</p>',
      status: 'published',
      publishedAt: new Date(),
      category: 'Network',
    },
    create: {
      slug: 'connect-corporate-vpn',
      title: 'Connect to corporate VPN',
      body: '<p>Install GlobalProtect, sign in with your LogIT email, and choose the <strong>HQ</strong> portal.</p>',
      status: 'published',
      publishedAt: new Date(),
      category: 'Network',
      createdById: senior.id,
    },
  });
  await prisma.knowledgeArticle.upsert({
    where: { slug: 'request-software-install' },
    update: {
      title: 'Request software installation',
      body: '<p>Use the Service Catalog item <em>Software install</em> or raise a service request with the package name and business justification.</p>',
      status: 'published',
      publishedAt: new Date(),
      category: 'Software',
    },
    create: {
      slug: 'request-software-install',
      title: 'Request software installation',
      body: '<p>Use Catalog → Software install, or open a service request.</p>',
      status: 'published',
      publishedAt: new Date(),
      category: 'Software',
      createdById: agent.id,
    },
  });
  await prisma.knowledgeArticle.upsert({
    where: { slug: 'draft-cab-checklist' },
    update: {
      title: 'CAB submission checklist (draft)',
      body: '<p>Risk, plan, rollback, schedule, and stakeholders must be filled before Submit to CAB.</p>',
      status: 'draft',
      category: 'Change',
    },
    create: {
      slug: 'draft-cab-checklist',
      title: 'CAB submission checklist (draft)',
      body: '<p>Risk, plan, rollback, schedule, and stakeholders must be filled before Submit to CAB.</p>',
      status: 'draft',
      category: 'Change',
      createdById: manager.id,
    },
  });

  const softwareFormSchema = [
    {
      name: 'softwareName',
      label: 'Software name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Adobe Acrobat',
    },
    {
      name: 'licenseNeeded',
      label: 'New license needed',
      type: 'checkbox',
    },
    {
      name: 'businessReason',
      label: 'Business reason',
      type: 'textarea',
      required: true,
    },
  ];

  const vpnFormSchema = [
    {
      name: 'deviceType',
      label: 'Device type',
      type: 'select',
      required: true,
      options: [
        { value: 'corporate', label: 'Corporate laptop' },
        { value: 'byod', label: 'Personal (BYOD)' },
      ],
    },
    {
      name: 'duration',
      label: 'Access duration',
      type: 'select',
      required: true,
      options: ['30 days', '90 days', 'Ongoing'],
      defaultValue: 'Ongoing',
    },
  ];

  await prisma.serviceCatalogItem.upsert({
    where: { code: 'REQ-SOFTWARE' },
    update: {
      name: 'Software install',
      description: 'Request installation of approved business software.',
      ticketTypeCode: 'service_request',
      categoryCode: 'SOFTWARE',
      teamId: serviceDesk.id,
      formSchema: softwareFormSchema,
      isActive: true,
    },
    create: {
      code: 'REQ-SOFTWARE',
      name: 'Software install',
      description: 'Request installation of approved business software.',
      ticketTypeCode: 'service_request',
      categoryCode: 'SOFTWARE',
      teamId: serviceDesk.id,
      formSchema: softwareFormSchema,
    },
  });
  await prisma.serviceCatalogItem.upsert({
    where: { code: 'ACC-MFA-RESET' },
    update: {
      name: 'MFA reset',
      description: 'Reset multifactor authentication for a locked account.',
      ticketTypeCode: 'access_request',
      categoryCode: 'ACCESS',
      teamId: serviceDesk.id,
      isActive: true,
    },
    create: {
      code: 'ACC-MFA-RESET',
      name: 'MFA reset',
      description: 'Reset multifactor authentication for a locked account.',
      ticketTypeCode: 'access_request',
      categoryCode: 'ACCESS',
      teamId: serviceDesk.id,
    },
  });
  await prisma.serviceCatalogItem.upsert({
    where: { code: 'REQ-VPN' },
    update: {
      name: 'VPN access',
      description: 'Enable corporate VPN for remote work.',
      ticketTypeCode: 'access_request',
      categoryCode: 'NETWORK',
      teamId: serviceDesk.id,
      formSchema: vpnFormSchema,
      isActive: true,
    },
    create: {
      code: 'REQ-VPN',
      name: 'VPN access',
      description: 'Enable corporate VPN for remote work.',
      ticketTypeCode: 'access_request',
      categoryCode: 'NETWORK',
      teamId: serviceDesk.id,
      formSchema: vpnFormSchema,
    },
  });

  const phoneType = await prisma.assetType.findUniqueOrThrow({
    where: { code: 'PHONE' },
  });
  const monitorType = await prisma.assetType.findUniqueOrThrow({
    where: { code: 'MONITOR' },
  });
  await prisma.asset.upsert({
    where: { assetTag: 'GH-IT-0003' },
    update: {
      status: 'in_service',
      assignedUserId: agent.id,
      name: 'Agent iPhone',
      locationId: hqLocation?.id ?? null,
    },
    create: {
      assetTag: 'GH-IT-0003',
      name: 'Agent iPhone',
      typeId: phoneType.id,
      serialNumber: 'SN-PHONE-003',
      manufacturer: 'Apple',
      model: 'iPhone 14',
      status: 'in_service',
      assignedUserId: agent.id,
      locationId: hqLocation?.id ?? null,
    },
  });
  await prisma.asset.upsert({
    where: { assetTag: 'GH-IT-0004' },
    update: {
      status: 'in_stock',
      name: 'Spare 27" monitor',
      locationId: hqLocation?.id ?? null,
    },
    create: {
      assetTag: 'GH-IT-0004',
      name: 'Spare 27" monitor',
      typeId: monitorType.id,
      serialNumber: 'SN-MON-004',
      manufacturer: 'Dell',
      model: 'U2722D',
      status: 'in_stock',
      locationId: hqLocation?.id ?? null,
    },
  });
  await prisma.asset.upsert({
    where: { assetTag: 'GH-IT-0005' },
    update: {
      status: 'in_repair',
      name: 'Broken Latitude (board)',
      locationId: hqLocation?.id ?? null,
    },
    create: {
      assetTag: 'GH-IT-0005',
      name: 'Broken Latitude (board)',
      typeId: laptopType.id,
      serialNumber: 'SN-LAP-005',
      manufacturer: 'Dell',
      model: 'Latitude 5420',
      status: 'in_repair',
      locationId: hqLocation?.id ?? null,
      notes: 'Awaiting depot repair — liquid damage.',
    },
  });

  // Sample in-app notifications (re-seed friendly: clear demo titles first)
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { title: { startsWith: 'Assigned INC-' } },
        { title: { startsWith: 'Approval needed —' } },
        { title: { startsWith: 'Major incident active —' } },
      ],
    },
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: agent.id,
        title: `Assigned INC-${year}-000003`,
        body: 'VPN disconnects every 10 minutes',
        link: `/app/tickets/INC-${year}-000003`,
      },
      {
        userId: approver.id,
        title: `Approval needed — REQ-${year}-000001`,
        body: 'Request laptop for new hire — Ops',
        link: '/app/approvals',
      },
      {
        userId: manager.id,
        title: `Major incident active — INC-${year}-000001`,
        body: 'Email outage — Exchange Online unreachable',
        link: '/app/major-incidents',
      },
    ],
  });

  // Inactive example outbound webhook (no live URL — enable after pointing at a real receiver)
  const exampleWebhookName = 'Example outbound (inactive)';
  const existingHook = await prisma.webhookEndpoint.findFirst({
    where: { name: exampleWebhookName },
  });
  if (!existingHook) {
    await prisma.webhookEndpoint.create({
      data: {
        name: exampleWebhookName,
        url: 'https://example.com/logit-hooks',
        secret: 'seed-example-secret-replace-me-xxxxxxxx',
        isActive: false,
        eventTypes: [
          'ticket.created',
          'ticket.updated',
          'ticket.assigned',
          'ticket.commented',
        ],
      },
    });
  }

  console.log('LogIT seed complete (Phase 1–11 MVP + demo sample data).');
  console.log('Demo accounts (development only — never use in production):');
  console.log(`  sysadmin     ${adminEmail} / ${adminPassword}`);
  console.log('  employee     employee@logit.local / LogIT-Employee-2026!');
  console.log('  agent        agent@logit.local / LogIT-Agent-2026!');
  console.log('  senior_agent senior@logit.local / LogIT-Senior-2026!');
  console.log('  it_manager   manager@logit.local / LogIT-Manager-2026!');
  console.log('  approver     approver@logit.local / LogIT-Approver-2026!');
  console.log('  auditor      auditor@logit.local / LogIT-Auditor-2026!');
  console.log('Sample tickets: INC/REQ/ACC/SEC/PRB/CHG queues, Major ops, Approvals, KB, Catalog, Assets.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
