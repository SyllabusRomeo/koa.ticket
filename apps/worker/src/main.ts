import { APP_NAME } from '@logit/shared';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function tickSla() {
  const open = await prisma.slaInstance.findMany({
    where: { completedAt: null },
    include: {
      ticket: { include: { status: true } },
      policy: { include: { escalations: true } },
    },
    take: 200,
  });

  const now = Date.now();
  let updated = 0;

  for (const inst of open) {
    if (inst.ticket.status.pausesSla) {
      if (!inst.pausedAt) {
        await prisma.slaInstance.update({
          where: { id: inst.id },
          data: { pausedAt: new Date() },
        });
      }
      continue;
    }

    if (inst.pausedAt) {
      const pausedMs = now - inst.pausedAt.getTime();
      await prisma.slaInstance.update({
        where: { id: inst.id },
        data: {
          pausedAt: null,
          dueAt: new Date(inst.dueAt.getTime() + pausedMs),
        },
      });
      updated++;
      continue;
    }

    if (inst.metric === 'first_response' && inst.ticket.firstResponseAt) {
      await prisma.slaInstance.update({
        where: { id: inst.id },
        data: {
          completedAt: inst.ticket.firstResponseAt,
          percentConsumed: 100,
        },
      });
      updated++;
      continue;
    }

    if (inst.metric === 'resolution' && inst.ticket.resolvedAt) {
      await prisma.slaInstance.update({
        where: { id: inst.id },
        data: {
          completedAt: inst.ticket.resolvedAt,
          percentConsumed: 100,
        },
      });
      updated++;
      continue;
    }

    const total = Math.max(1, inst.dueAt.getTime() - inst.startedAt.getTime());
    const used = now - inst.startedAt.getTime();
    const percent = Math.max(0, Math.min(200, (used / total) * 100));

    await prisma.slaInstance.update({
      where: { id: inst.id },
      data: {
        percentConsumed: percent,
        breachedAt:
          percent >= 100 && !inst.breachedAt ? new Date() : inst.breachedAt,
      },
    });
    updated++;
  }

  console.log(
    `[${APP_NAME} worker] SLA tick open=${open.length} updated=${updated}`,
  );
}

async function main() {
  console.log(`[${APP_NAME} worker] starting (SLA every 60s)`);
  await tickSla();
  setInterval(() => {
    void tickSla().catch((err) =>
      console.error(`[${APP_NAME} worker] tick failed`, err),
    );
  }, 60_000);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
