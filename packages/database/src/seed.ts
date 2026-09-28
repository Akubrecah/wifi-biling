import { PrismaClient, UserRole, PlanType } from '@prisma/client';
import { hash, Algorithm } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Super Admin
  const adminEmail = 'admin@wifibilling.local';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await hash('Admin@Pass123!', {
      algorithm: Algorithm.Argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'System Superadmin',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log('✅ Created Superadmin: admin@wifibilling.local');
  } else {
    console.log('ℹ️ Superadmin already exists.');
  }

  // 2. Seed Default Location
  const locationSlug = 'central-hotspot';
  let location = await prisma.location.findUnique({
    where: { slug: locationSlug },
  });

  if (!location) {
    location = await prisma.location.create({
      data: {
        name: 'Central Hotspot Hub',
        slug: locationSlug,
        description: 'Primary MikroTik hotspot location zone',
        address: 'Nairobi Central, Kenya',
        contactPhone: '+254700000000',
      },
    });
    console.log('✅ Created Location: Central Hotspot Hub');
  } else {
    console.log('ℹ️ Location already exists.');
  }

  // 3. Seed MikroTik-E7161B Router Gateway
  const nasIdentifier = 'MT-E7161B-01';
  const existingRouter = await prisma.router.findUnique({
    where: { nasIdentifier },
  });

  if (!existingRouter) {
    await prisma.router.create({
      data: {
        name: 'MikroTik-E7161B Gateway',
        nasIdentifier,
        locationId: location.id,
        ipAddress: '192.168.88.1',
        radiusSecret: 'testing123_production_radius_secret',
        apiPort: 8729,
        apiUsername: 'api_billing',
        apiPassword: 'secure_router_password',
        isActive: true,
      },
    });
    console.log('✅ Created Router: MikroTik-E7161B Gateway');
  } else {
    console.log('ℹ️ Router already exists.');
  }

  // 4. Seed FreeRADIUS NAS client table
  const existingNas = await prisma.nas.findFirst({
    where: { nasname: '192.168.88.1' },
  });

  if (!existingNas) {
    await prisma.nas.create({
      data: {
        nasname: '192.168.88.1',
        shortname: 'MT-E7161B-01',
        type: 'mikrotik',
        ports: 1812,
        secret: 'testing123_production_radius_secret',
        description: 'MikroTik-E7161B Gateway RADIUS client',
      },
    });
    console.log('✅ Seeded FreeRADIUS NAS client table');
  }

  // 5. Seed Standard Bandwidth Plans
  const plans = [
    {
      name: '1 Hour Unlimited',
      description: 'Superfast unlimited internet for 1 hour',
      price: 20,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 3600,
      dataLimitBytes: null,
      downloadSpeed: 5120, // 5 Mbps
      uploadSpeed: 2048,   // 2 Mbps
      burstDown: 8192,
      burstUp: 4096,
      burstThreshold: 3072,
      burstDuration: 10,
      maxDevices: 1,
    },
    {
      name: '3 Hours Unlimited',
      description: 'Superfast unlimited internet for 3 hours',
      price: 50,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 10800,
      dataLimitBytes: null,
      downloadSpeed: 5120,
      uploadSpeed: 2048,
      burstDown: 8192,
      burstUp: 4096,
      burstThreshold: 3072,
      burstDuration: 10,
      maxDevices: 1,
    },
    {
      name: '24 Hours Unlimited',
      description: '24 hours uncapped internet pass',
      price: 100,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 86400,
      dataLimitBytes: null,
      downloadSpeed: 10240, // 10 Mbps
      uploadSpeed: 4096,    // 4 Mbps
      maxDevices: 1,
    },
    {
      name: '7 Days Unlimited',
      description: 'Weekly unlimited high-speed connectivity',
      price: 500,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 604800,
      dataLimitBytes: null,
      downloadSpeed: 10240,
      uploadSpeed: 5120,
      maxDevices: 2,
    },
    {
      name: '30 Days Unlimited',
      description: 'Monthly unlimited high-speed package',
      price: 1500,
      currency: 'KES',
      planType: PlanType.TIME_BASED,
      durationSec: 2592000,
      dataLimitBytes: null,
      downloadSpeed: 15360, // 15 Mbps
      uploadSpeed: 5120,
      maxDevices: 3,
    },
    {
      name: '5GB Data Pass',
      description: '5GB high-speed data quota valid for 7 days',
      price: 100,
      currency: 'KES',
      planType: PlanType.HYBRID,
      durationSec: 604800,
      dataLimitBytes: BigInt(5368709120), // 5 * 1024 * 1024 * 1024
      downloadSpeed: 10240,
      uploadSpeed: 5120,
      maxDevices: 1,
    },
    {
      name: '20GB Data Pass',
      description: '20GB high-speed data quota valid for 30 days',
      price: 300,
      currency: 'KES',
      planType: PlanType.HYBRID,
      durationSec: 2592000,
      dataLimitBytes: BigInt(21474836480), // 20 * 1024 * 1024 * 1024
      downloadSpeed: 15360,
      uploadSpeed: 8192,
      maxDevices: 2,
    },
  ];

  for (const planData of plans) {
    const existingPlan = await prisma.plan.findFirst({
      where: { name: planData.name },
    });

    if (!existingPlan) {
      await prisma.plan.create({
        data: {
          ...planData,
          locationId: location.id,
          isActive: true,
        },
      });
      console.log(`✅ Seeded Plan: ${planData.name} (KES ${planData.price})`);
    } else {
      console.log(`ℹ️ Plan "${planData.name}" already exists.`);
    }
  }

  console.log('✨ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
